module.exports = {
    env: {
        browser: true,
        es2020: true,
        jquery: true,
        node: true,
    },
    extends: 'eslint:recommended',
    globals: {
        regtest_data: 'readonly',
        regtest_event: 'readonly',
        regtest_log: 'readonly',
    },
    parserOptions: {
        ecmaVersion: 12,
        sourceType: 'module',
    },
    root: true,
    rules: {
        eqeqeq: ['error', 'always', {'null': 'ignore'}],
        indent: ['error', 4],
        'linebreak-style': ['error', 'unix'],
        'no-empty': ['off'],
        'no-var': ['error'],
        'prefer-const': ['error', {"destructuring": "all"}],
        quotes: ['error', 'single'],
        semi: ['error', 'never'],
    },
}