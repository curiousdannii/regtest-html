#!/bin/sh

cd "$(dirname "$0")/.."

./bin/regtest.js -i tests/parchment.html tests/praxix.z5.regtest
./bin/regtest.js -i tests/parchment.html tests/advent.z5.regtest