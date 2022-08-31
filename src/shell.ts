/*=====================================================================*/
/*    serrano/prgm/project/jscontract/eco/src/shell.ts                 */
/*    -------------------------------------------------------------    */
/*    Author      :  manuel serrano                                    */
/*    Creation    :  Tue Aug 30 23:23:23 2022                          */
/*    Last change :  Wed Aug 31 17:34:19 2022 (serrano)                */
/*    Copyright   :  2022 manuel serrano                               */
/*    -------------------------------------------------------------    */
/*    Shell environments                                               */
/*=====================================================================*/

/*---------------------------------------------------------------------*/
/*    The module                                                       */
/*---------------------------------------------------------------------*/
import os from "os";
import fs from "fs";
import path from "path";
import { log, system, run } from "./util";
import { spawn, execSync } from "child_process";
import type { ChildProcessWithoutNullStreams } from "child_process";
import { mkdirp, rm } from "fs-extra";

/*---------------------------------------------------------------------*/
/*    Shell ...                                                        */
/*---------------------------------------------------------------------*/
export abstract class Shell {
  public home: string = "";
  public tmp: string = "";
  
  constructor(home: string) {
    this.home = home;
  }
  abstract init(): any;
  abstract cleanup(): any;
  abstract log(msg: string): void;
  abstract fork(lib: string): Promise<Shell>;
  abstract rm(dir: string, opt: { force: boolean, recursive: boolean }): void;
  abstract mkdirp(dir: string): void;
  abstract spawn(cmd: string, opt: { shell: boolean, cwd: string }): ChildProcessWithoutNullStreams;
  abstract chdir(dir: string): void;
  abstract cwd(): string;
}

/*---------------------------------------------------------------------*/
/*    HostShell ...                                                    */
/*---------------------------------------------------------------------*/
export class HostShell extends Shell {
  constructor() { 
    super(os.homedir());
  }
  
  init() {
  }
  
  cleanup() {
  }

  log(msg: string): void {
    log(`[HostShell] ${msg}`);
  }
    
  async fork(lib: string): Promise<Shell> {
    const sh = new HostShell();
    sh.tmp = "/tmp/" + lib;
    
    // create the tmp directory
    mkdirp(sh.tmp);
    
    return new Promise((res, rej) => res(sh));
  }

  async rm(dir: string, opt: { force: boolean, recursive: boolean }) {
    const d = dir.replace(/~/, this.home);
    
    this.log(`rm [${d}]`);
    return rm(d, opt);
  }
  
  async mkdirp(dir: string) {
    const d = dir.replace(/~/, this.home);
    
    this.log(`mkdirp [${d}]`);
    return mkdirp(d);
  }
  
  async chdir(dir: string) {
    const d = dir.replace(/~/, this.home);
    process.chdir(d);
  }
  
  cwd(): string {
    return process.cwd();
  }
  
  spawn(cmd: string, opt: { shell: boolean, cwd: string }): ChildProcessWithoutNullStreams {
    const acmd = cmd.replace(/~/, this.home);
    const fname = path.join(this.tmp, "cmd");
    const fd = fs.openSync(fname, "w");
    
    this.log(`spawn [${acmd}]`);
    
    fs.writeSync(fd, "#!/bin/bash\n");
    fs.writeSync(fd, `cd ${opt?.cwd || this.cwd()}\n`);
    fs.writeSync(fd, `${acmd}\n`);
    fs.closeSync(fd);

    fs.chmodSync("/tmp/cmd", "a+rx")
    
    return spawn("/tmp/cmd");
  }
}
 
/*---------------------------------------------------------------------*/
/*    DockerShell ...                                                  */
/*---------------------------------------------------------------------*/
export class DockerShell extends Shell {
  private dockerFile: string;
  private imageName: string;
  private $cwd: string = "";
  private $terminating: boolean = false;
  private lib: string | null = null;
  
  constructor(home: string, dockerFile: string, imageName: string) {
    super(home);
    this.dockerFile = dockerFile;
    this.imageName = imageName
    this.$cwd = this.home;
  }

  log(msg: string): void {
    log(`[DockerShell] ${msg}`);
  
  }
  
  async fork(lib: string): Promise<Shell> {
    const sh = new DockerShell(this.home, this.dockerFile, this.imageName);
    sh.lib = lib;
    sh.tmp = "/tmp/" + lib;
    
    // create the tmp directory
    mkdirp(sh.tmp);
    
    // create the docker container
    const cmd = `docker run --name ${sh.containerName()} ${sh.imageName} -c "tail -f /dev/null"`;
   
    this.log(`forking container "${this.imageName}.${lib}" [${cmd}]`);
    // this command will eventually be abruptly stopped
    run(cmd).catch((e) => { 
      if (!sh.$terminating) {
        console.error(`fork failed: ${e.toString()}`);
      }});

    return new Promise((res, rej) => setTimeout(() => res(sh), 2000));
  }

  containerName(): string {
    if (this.lib) {
      return `${this.imageName}.${this.lib}`;
    } else {
      throw "DockerShell not forked";
    }
  }
  
  wrap(cmd: string) {
    return `docker exec ${this.containerName()} ${cmd}`;
  }
  
  async init(): Promise<boolean> {
    // check if the docker image already exists
    const checkcmd = `docker image inspect --format="-" ${this.imageName}`;
    
    this.log(`checking the image [${checkcmd}]`);
    const { stdout } = await system(checkcmd, false);

    if (stdout !== "-") {
      // there is not docker image, create one...
      const buildcmd = `docker build -f ${this.dockerFile} -t ${this.imageName} .`;
    
      this.log(`creating the image [${buildcmd}]`);
    
      const { code } = await system(buildcmd, true);
      if (code !== 0) {
         console.error("Cannot create the docker image...");
         process.exit(1);
      }
    }
    
    return true;
  }
  
  async cleanup() {
    const cmd = `docker rm -f ${this.containerName()}`;
   
    this.log(`cleaning docker container [${cmd}]`);
    this.$terminating = true;
    await run(cmd);
  }
  
  async rm(dir: string, opt: { force: boolean, recursive: boolean }) {
    const d = dir.replace(/~/, this.home);
    const cmd = `rm ${opt.recursive ? "-r" : ""} ${opt.force ? "-f" : ""} ${d}`
    const wcmd = this.wrap(cmd);
   
    this.log(`rm [${wcmd}]`);
    await run(wcmd);
  }
  
  async mkdirp(dir: string) {
    const d = dir.replace(/~/, this.home);
    const cmd = `mkdir -p ${d}`
    const wcmd = this.wrap(cmd);
   
    this.log(`mkdirp [${wcmd}]`);
    await run(wcmd);
  }
  
  async chdir(dir: string) {
    const d = dir.replace(/~/, this.home);
    this.$cwd = d;
  }
  
  cwd() {
    return this.$cwd;
  }
  
  spawn(cmd: string, opt: { shell: boolean, cwd: string }): ChildProcessWithoutNullStreams {
    const acmd = cmd.replace(/~/, this.home);
    const fname = path.join(this.tmp, "cmd");
    const fd = fs.openSync(fname, "w");
    
    this.log(`spawn [${acmd}]`);
    
    fs.writeSync(fd, "#!/bin/bash\n");
    fs.writeSync(fd, `cd ${opt?.cwd || this.cwd()}\n`);
    fs.writeSync(fd, `${acmd}\n`);
    fs.closeSync(fd);
    
    execSync(`docker cp ${fname} ${this.containerName()}:/tmp/cmd`);
    execSync(`docker exec --user root ${this.containerName()} chown scotty:scotty /tmp/cmd`);
    execSync(`docker exec ${this.containerName()} chmod a+rx /tmp/cmd`);
    
    return spawn("docker", ["exec", this.containerName(), "/tmp/cmd"]);
  }
}