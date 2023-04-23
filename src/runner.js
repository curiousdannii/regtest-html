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

export class Runner {
    constructor(testfile_data, options) {
        this.errors = 0
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
        // If the interpreter path is not already a URL, then construct it
        try {
            new URL(options.interpreter_path)
            options.interpreter_url = options.interpreter_path
        }
        catch (_) {
            options.interpreter_url = `http://localhost:${options.port}/${path.relative(cwd, options.interpreter_path)}`
        }
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

    make_input_request_handler() {
        this.input_request_handler = new Promise((resolve, reject) => {
            const timer = setTimeout(async () => {
                if (this.options.pdf) {
                    await fs.writeFile('error.pdf', await this.page.pdf())
                }
                reject(new Error('Timed out awaiting output'))
            }, 1000 * this.options.timeout)
            this.input_request = data => {
                clearTimeout(timer)
                resolve(data)
            }
        })
    }

    async run_one_test(test) {
        console.log(`* ${test}`)
        this.buffertext = ''
        this.make_input_request_handler()
        this.waiting_for_final_text = 0
        await this.page.goto(`${this.options.interpreter_url}?story=${this.options.gamefile_url}&do_vm_autosave`)
        await this.run_test_script(test)
    }

    async run_test_script(test) {
        const test_regex = new RegExp(`^\\*\\s+${test}\\s*$`)
        let found_the_test = false
        let checks = []

        const process_delayed_checks = async () => {
            for (let check of checks) {
                const inverted = check.startsWith('!')
                if (inverted) {
                    check = check.substring(1)
                }
                const found = this.buffertext.includes(check)
                if (!found && !inverted) {
                    this.errors++
                    console.error(`Literal check "${check}": not found`)
                    if (this.options.pdf) {
                        await fs.writeFile('error.pdf', await this.page.pdf())
                    }
                }
                else if (found && inverted) {
                    this.errors++
                    console.error(`Inverted literal check "${check}": should not be found`)
                    if (this.options.pdf) {
                        await fs.writeFile('error.pdf', await this.page.pdf())
                    }
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

            // Skip blank lines and comments
            if (line === '' || line.startsWith('#')) {
                continue
            }

            if (line.startsWith('>{include}')) {
                await this.run_test_script(line.substring(10).trim())
            }
            else if (line.startsWith('>')) {
                const requested_event = await this.input_request_handler

                // Make a new promise to await
                this.make_input_request_handler()

                // Process the delayed checks
                await process_delayed_checks()
                this.buffertext = ''
                checks = []

                // Check the requested event type
                let type = 'line'
                let command = line.substring(1).trim()
                if (requested_event.type === 'fileref_prompt') {
                    if (!line.startsWith('>{fileref_prompt}')) {
                        throw new Error('Game is not expecting fileref_prompt input')
                    }
                    type = 'fileref_prompt'
                    command = line.substring(17).trim()
                }
                else if (requested_event.type === 'char') {
                    if (!line.startsWith('>{char}')) {
                        throw new Error('Game is not expecting char input')
                    }
                    type = 'char'
                    command = line.substring(7).trim()
                }
                else if (requested_event.type !== 'line') {
                    throw new Error('Game is not expecting line input')
                }

                // Send the input

                await this.page.evaluate((type, command) => {
                    regtest_event({
                        type,
                        value: command,
                    })
                }, type, command)
            }
            // Skip other tests
            else if (line.startsWith('* ')) {
                break
            }
            else {
                checks.push(line)
            }
        }

        // We may need to wait for some text to be sent
        if (checks.length) {
            if (!this.buffertext) {
                this.waiting_for_final_text = 1
                await this.input_request_handler
            }
            await process_delayed_checks()
        }
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
                if (this.waiting_for_final_text) {
                    this.input_request()
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