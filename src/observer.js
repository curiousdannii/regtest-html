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
        regtest_log('glkote_buffer_text_observer records length', records.length)
        for (const record of records) {
            if (record.type === 'characterData') {
            }
        }
    })

    const glkote_input_observer = new MutationObserver(records => {
        regtest_log('glkote_input_observer')
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
                        glkote_buffer_text_observer.observe($node.find('.BufferWindowInner')[0], {characterData: true, subtree: true})

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
    }

})