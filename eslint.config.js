import js from '@eslint/js'
import globals from 'globals'

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 12,
            globals: {
                ...globals.browser,
                ...globals.es2020,
                ...globals.jquery,
                ...globals.node,
                regtest_data: 'readonly',
                regtest_event: 'readonly',
                regtest_log: 'readonly',
            },
            sourceType: 'module',
        },
        rules: {
            eqeqeq: ['error', 'always', {'null': 'ignore'}],
            indent: ['error', 4],
            'linebreak-style': ['error', 'unix'],
            'no-empty': ['off'],
            'no-var': ['error'],
            'prefer-const': ['error', {'destructuring': 'all'}],
            quotes: ['error', 'single'],
            semi: ['error', 'never'],
        },
    },
]