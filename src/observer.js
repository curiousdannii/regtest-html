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

            // Scroll the buffer window down
            const target = $(record.target)
            if (target.hasClass('BufferWindowInner')) {
                target.parent().scrollTop(target.height())
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
                if (input.is('[aria-hidden=true],:disabled')) {
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
                    }

                    // Watch the Input (could be in a grid window too)
                    const input = $node.find('.Input')
                    if (input.length) {
                        glkote_input_observer.observe(input[0], {attributeFilter: ['aria-hidden', 'disabled']})
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

    // Observe the opening of the async dialog
    const glkote_async_dialog_observer = new MutationObserver(records => {
        for (const record of records) {
            if (record.type === 'attributes') {
                const dialog = $(record.target)
                if (dialog.prop('open')) {
                    regtest_data({
                        type: 'input_requested',
                        data: {
                            type: 'fileref_prompt',
                        },
                    })
                }
            }
        }
    })

    // Observe the body for the insertion of the async dialog
    let async_dialog
    const body_observer = new MutationObserver(records => {
        for (const record of records) {
            if (record.type === 'childList') {
                for (const node of record.addedNodes) {
                    const $node = $(node)
                    if ($node.hasClass('asyncglk_file_dialog')) {
                        async_dialog = $node
                        glkote_async_dialog_observer.observe($node[0], {attributeFilter: ['open']})
                        body_observer.disconnect()
                    }
                }
            }
        }
    })
    body_observer.observe(document.body, {childList: true})

    // Submit a Glk event
    window.regtest_event = data => {
        if (data.type === 'line') {
            $('.Input.LineInput')
                .val(data.value)
                .trigger(code_to_event('return'))
        }
        if (data.type === 'char') {
            $('.Input:not(:disabled)')
                .trigger(code_to_event(data.value))
        }
        if (data.type === 'fileref_prompt') {
            // Now to fill in the dialog form...
            if (async_dialog) {
                const form_button = async_dialog.find('> .inner > .foot button.submit')
                if (form_button.text() === 'Save') {
                    $('#filename_input').val(data.value)
                }
                else {
                    const options = async_dialog.find('> .inner > div[role=listbox] button')
                    for (const option of options) {
                        const $option = $(option)
                        if ($option.find('.name').text().startsWith(data.value + '.')) {
                            $option.click()
                        }
                    }
                }
                form_button.click()
            }
            else {
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
    }

})

// Turn a GlkOte keyboard code into a keyboard event
const KEY_NAMES_TO_CODES = {
    delete: 8, // Backspace to be precise
    down: 40,
    end: 35,
    escape: 27,
    func1: 112,
    func2: 113,
    func3: 114,
    func4: 115,
    func5: 116,
    func6: 117,
    func7: 118,
    func8: 119,
    func9: 120,
    func10: 121,
    func11: 122,
    func12: 123,
    home: 36,
    left: 37,
    pagedown: 34,
    pageup: 33,
    return: 13,
    right: 39,
    tab: 9,
    up: 38,
}
function code_to_event(code) {
    let event_type = 'keypress'
    if (KEY_NAMES_TO_CODES[code]) {
        event_type = code === 'return' ? 'keypress' : 'keydown'
        code = KEY_NAMES_TO_CODES[code]
    }
    else {
        if (code === 'space') {
            code === ' '
        }
        code = code.charCodeAt(0)
    }
    return jQuery.Event(event_type, {which: code})
}

window.addEventListener('unhandledrejection', function(event) {
    regtest_log('Unhandled promise rejection', event.reason)
})