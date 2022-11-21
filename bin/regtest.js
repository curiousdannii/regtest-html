#!/usr/bin/env node

/*

RegTest-HTML
============

Copyright (c) 2022 Dannii Willis
MIT licenced
https://github.com/curiousdannii/regtest-html

*/

import fs from 'fs'

import minimist from 'minimist'

import {Runner} from '../src/runner.js'

// Process the arguments
const argv = minimist(process.argv.slice(2))

const testfile_path = argv._[0]
if (!testfile_path) {
    console.log('No testfile specified')
    process.exit()
}
const testfile = fs.readFileSync(testfile_path, 'utf8')

const options = {
    gamefile_path: argv.g || argv.game,
    interpreter_path: argv.i || argv.interpreter,
    //list: argv.l || argv.list,
    port: 8080,
    tests: argv._.slice(1),
    testfile_path,
    verbose: argv.v || argv.verbose,
    //vital: argv.vital,
}

const runner = new Runner(testfile, options)
runner.run()