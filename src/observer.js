/*

Injected observer
=================

Copyright (c) 2022 Dannii Willis
MIT licenced
https://github.com/curiousdannii/regtest-html

*/

document.addEventListener('DOMContentLoaded', () => {

    // Attach observers for GlkOte

    const glkote_buffer_text_observer = new MutationObserver(records => {
        // Results from the previous BufferLine
        const span_results = []
        const div_results = []
        let last_buffer_line
        for (const record of records) {
            if (record.type === 'childList') {
                for (const node of record.addedNodes) {
                    const $node = $(node)
                    if ($node.is('span')) {
                        span_results.push($node.text())
                    }
                    else if ($node.hasClass('BufferLine')) {
                        div_results.push($node.text())
                        last_buffer_line = $node
                    }
                }
            }
        }
        const results = span_results.join('') + (span_results.length ? '\n' : '') + div_results.join('\n')
        regtest_data({
            type: 'buffertext',
            text: results,
        })

        // And watch for more additions to the last BufferLine
        if (last_buffer_line) {
            glkote_buffer_text_observer.observe(last_buffer_line[0], {childList: true})
        }
    })

    const glkote_input_observer = new MutationObserver(records => {
        for (const record of records) {
            if (record.type === 'attributes') {
                const input = $(record.target)
                if (input.is(':disabled')) {
                    continue
                }
                regtest_data({
                    type: 'input_requested',
                    data: {
                        type: input.hasClass('LineInput') ? 'line' : 'char',
                    },
                })
            }
        }
    })

    const glkote_window_obsever = new MutationObserver(records => {
        for (const record of records) {
            if (record.type === 'childList') {
                for (const node of record.addedNodes) {
                    const $node = $(node)
                    if ($node.hasClass('BufferWindow')) {
                        // At this point in time some text is likely to have already been printed, so capture it
                        regtest_data({
                            type: 'buffertext',
                            text: $node.find('.BufferLine')
                                .map((_, node) => $(node).text())
                                .get()
                                .join('\n'),
                        })
                        // And then watch for future additions
                        glkote_buffer_text_observer.observe($node.find('.BufferWindowInner')[0], {childList: true})
                        const last_line = $node.find('.BufferLine').last()[0]
                        if (last_line) {
                            glkote_buffer_text_observer.observe(last_line, {childList: true})
                        }

                        // Watch the Input
                        const input = $node.find('.Input')
                        glkote_input_observer.observe(input[0], {attributeFilter: ['disabled']})
                        // And send its current state
                        if (!input.prop('disabled')) {
                            regtest_data({
                                type: 'input_requested',
                                data: {
                                    type: input.hasClass('LineInput') ? 'line' : 'char',
                                },
                            })
                        }
                    }

                    if ($node.is('#dialog_frame')) {
                        regtest_data({
                            type: 'input_requested',
                            data: {
                                type: 'fileref_prompt',
                            },
                        })
                    }
                }
            }
        }
    })

    glkote_window_obsever.observe(document.getElementById('windowport'), {childList: true})

    // Submit a Glk event
    window.regtest_event = data => {
        if (data.type === 'line') {
            $('.Input.LineInput')
                .val(data.value)
                .trigger(jQuery.Event('keypress', {which: 13}))
        }
        if (data.type === 'fileref_prompt') {
            // Now to fill in the dialog form...
            const accept = $('#dialog_accept')
            if (accept.text() === 'Save') {
                $('#dialog_infield').val(data.value)
            }
            else {
                const test = new RegExp(`^${data.value}\\s`)
                const options = $('#dialog_select option')
                for (const option of options) {
                    const $option = $(option)
                    if (test.test($option.text())) {
                        $option.prop('selected', true)
                    }
                }
            }
            accept.click()
        }
    }

})