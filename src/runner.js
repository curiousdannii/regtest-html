/*

RegTest-HTML Runner
===================

Copyright (c) 2022 Dannii Willis
MIT licenced
https://github.com/curiousdannii/regtest-html

*/

import fs from 'fs/promises'
import path from 'path'

import {HttpServer} from 'http-server'
import puppeteer from 'puppeteer'
import { stdout } from 'process'

export class Runner {
    constructor(testfile_data, options) {
        this.buffertext = ''
        this.errors = 0
        this.input_request_handler = new Promise(resolve => this.input_request = resolve)
        this.list_of_tests = []
        this.options = options
        this.testfile = testfile_data.split(/\n/g).map(line => line.trim())

        // Process testfile parameters
        for (const line of this.testfile) {
            if (line.startsWith('**')) {
                const command_parts = /^\*\*\s+(\w+):\s+(\S.+)$/.exec(line)
                const command = command_parts?.[1]
                if (command === 'game' && !options.gamefile_path) {
                    options.gamefile_path = path.join(path.dirname(options.testfile_path), command_parts?.[2])
                }
                if (command === 'interpreter' && !options.interpreter_path) {
                    options.interpreter_path = path.join(path.dirname(options.testfile_path), command_parts?.[2])
                }
            }
            else if (line.startsWith('*')) {
                this.list_of_tests.push(/^\*\s+(\S.+)$/.exec(line)?.[1]?.trim())
            }
        }

        if (!options.interpreter_path) {
            console.log('No interpreter specified')
            process.exit()
        }
        const cwd = process.cwd()
        options.interpreter_url = `http://localhost:${options.port}/${path.relative(cwd, options.interpreter_path)}`
        options.gamefile_url = options.gamefile_path ? `http://localhost:${options.port}/${path.relative(cwd, options.gamefile_path)}` : ''

        if (!options.tests || !options.tests.length) {
            options.tests = this.list_of_tests.slice()
        }

        //console.log(options)
    }

    async run() {
        // Start a local HTTP server
        const server = new HttpServer()
        server.listen(this.options.port)

        // Set up Puppeteer
        await this.setup_puppeteer()

        // Run all the tests
        for (const test of this.options.tests) {
            await this.run_one_test(test)
        }

        // We're finished, so shut it down
        await this.browser.close()
        server.close()

        if (this.errors) {
            console.error(`FAILED: ${this.errors} errors`)
            process.exit(1)
        }
    }

    async run_one_test(test) {
        console.log(`* ${test}`)
        await this.page.goto(`${this.options.interpreter_url}?story=${this.options.gamefile_url}`)
        await this.run_test_script(test)
    }

    async run_test_script(test) {
        const test_regex = new RegExp(`^\\*\\s+${test}\\s*$`)
        let found_the_test = false
        let checks = []

        const process_delayed_checks = () => {
            for (const check of checks) {
                if (!this.buffertext.includes(check)) {
                    this.errors++
                    console.error(`Literal check "${check}": not found`)
                }
            }
        }

        for (const line of this.testfile) {
            // Skip everything before the test
            if (!found_the_test) {
                if (test_regex.test(line)) {
                    found_the_test = true
                }
                continue
            }

            // Skip blank lines
            if (line === '') {
                continue
            }

            if (line.startsWith('>')) {
                const requested_event = await this.input_request_handler

                // Make a new promise to await
                this.input_request_handler = new Promise(resolve => this.input_request = resolve)

                // Process the delayed checks
                process_delayed_checks()
                checks = []

                // Check the requested event type
                if (requested_event.type !== 'line') {
                    throw new Error('Game is not expecting line input')
                }

                // Send the input
                await this.page.evaluate(command => {
                    regtest_event({
                        type: 'line',
                        value: command,
                    })
                }, line.substring(1).trim())
            }
            else {
                checks.push(line)
            }

            // Skip other tests
            if (line.startsWith('* ')) {
                break
            }
        }

        process_delayed_checks()
    }

    async setup_puppeteer() {
        this.browser = await puppeteer.launch()
        this.page = await this.browser.newPage()

        // Log any page errors
        this.page.on('error', err => console.error(`Page error: ${err}`))
        this.page.on('pageerror', err => console.error(`Page error: ${err}`))

        // Receive data back from the injected script
        await this.page.exposeFunction('regtest_data', data => {
            if (data.type === 'buffertext') {
                this.buffertext += data.text
                if (this.options.verbose) {
                    process.stdout.write(data.text)
                }
            }

            if (data.type === 'input_requested') {
                this.input_request(data.data)
            }
        })
        await this.page.exposeFunction('regtest_log', console.log)

        // Inject our mutation observer script
        const observer_script = await fs.readFile(new URL('./observer.js', import.meta.url), 'utf8')
        await this.page.evaluateOnNewDocument(observer_script)
    }
}