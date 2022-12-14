#!/bin/sh
#*=====================================================================*/
#*    serrano/prgm/project/jscontract/eco/lists/eco-statistics.sh      */
#*    -------------------------------------------------------------    */
#*    Author      :  Manuel Serrano                                    */
#*    Creation    :  Thu Jul 28 08:45:39 2022                          */
#*    Last change :  Mon Sep  5 21:32:34 2022 (serrano)                */
#*    Copyright   :  2022 Manuel Serrano                               */
#*    -------------------------------------------------------------    */
#*    Generate ECO statistics.                                         */
#*    Usage:                                                           */
#*      eco-statistics.sh [logdir]                                     */
#*                                                                     */
#*    Example:                                                         */
#*      eco-statistics.sh $HOME/.eco/JavaScript                        */
#*=====================================================================*/

# command line parsing
if [ "$1 " != " " ]; then
  LOGDIR=$1
else  
  LOGDIR=$HOME/.eco/scotty
fi  

if [ "$2 " != " " ]; then
  SANDBOXDIR=$2
else  
  SANDBOXDIR=""
fi  

echo "{"

# header
echo "  \"head\": \"Automatically generated by eco-statistics.sh\","
echo "  \"date\": \"`date`\","

# number of packages
pkgnum=`find $LOGDIR -type f -print -name '*' | wc -l`
echo "  \"numPackages\": $pkgnum,"

# packages that reach step 1 (git repo found)
step1=`grep -l "ECO:STEP 1/" $LOGDIR/DT-ALL.*/* | wc -l`
echo "  \"step1\": $step1,"

# packages that reach step 2 (install the dependencies)
step2=`grep -l "ECO:STEP 2/" $LOGDIR/DT-ALL.*/* | wc -l`
echo "  \"step2\": $step2,"

# packages that reach step 3 (run the unit tests)
step3=`grep -l "ECO:STEP 3/" $LOGDIR/DT-ALL.*/* | wc -l`
echo "  \"step3\": $step3,"

# packages that reach step 4 (run the unit tests in identity mode)
step4=`grep -l "ECO:STEP 4/" $LOGDIR/DT-ALL.*/* | wc -l`
echo "  \"step4\": $step4,"

# packages that reach step 5 (run the unit tests in proxy mode)
step5=`grep -l "ECO:STEP 5/" $LOGDIR/DT-ALL.*/* | wc -l`
echo "  \"step5\": $step5,"

# packages that reach step 6 (run the unit tests with full contrac checking)
step6=`grep -l "ECO:STEP 6/" $LOGDIR/DT-ALL.*/* | wc -l`
echo "  \"step6\": $step6,"

# packages that reach step 7 (test complete)
step7=`grep -l "ECO:STEP 7/" $LOGDIR/DT-ALL.*/* | wc -l`
echo "  \"step7\": $step7",

# failing imports
if [ "$SANDBOXDIR " != " " ]; then
  failingimports=`(cd $SANDBOXDIR; find . -name '*.d.ts' -print | xargs grep import | awk -F/ '{print $2}' | sort | uniq | wc -l)`
  testsnotests=`(cd $SANDBOXDIR; find . -maxdepth 2 -name 'package.json' | xargs grep "Error: no test specified" 2> /dev/null | sort | uniq | wc -l)`
else
  # values collected after executing eco-all-list.sh on 30jul2022
  failingimports=1790
  testsnotests=1723
fi

echo "  \"failingImports\": $failingimports,"
echo "  \"testsNoTests\": $testsnotests"


echo "}"
