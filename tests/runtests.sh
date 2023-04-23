#!/bin/sh

cd "$(dirname "$0")/.."

echo Praxix
./bin/regtest.js -i tests/parchment.html tests/praxix.z5.regtest
echo Advent
./bin/regtest.js -i tests/parchment.html tests/advent.z5.regtest