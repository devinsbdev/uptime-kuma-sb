module.exports = {
    ignorePatterns: [
        "test/*",
        "server/modules/**",
        "src/util.js"
    ],
    root: true,
    env: {
        browser: true,
        commonjs: true,
        es2020: true,
        node: true,
    },
    extends: [
        "eslint:recommended",
        "plugin:vue/vue3-recommended",
    ],
    parser: "vue-eslint-parser",
    parserOptions: {
        parser: "@babel/eslint-parser",
        sourceType: "module",
        requireConfigFile: false,
    },
    rules: {
        "yoda": "warn",
        eqeqeq: [ "warn", "smart" ],
        "linebreak-style": [ "warn", "windows" ],
        // "camelcase": [ "warn", {
        //     "properties": "never",
        //     "ignoreImports": true
        // }],
        "no-unused-vars": [ "warn", {
            "args": "none"
        }],
        indent: [
            "warn",
            4,
            {
                ignoredNodes: [ "TemplateLiteral" ],
                SwitchCase: 1,
            },
        ],
        quotes: [ "off", "double" ],
        semi: "warn",
        "vue/html-indent": [ "warn", 4 ], // default: 2
        "vue/max-attributes-per-line": "off",
        "vue/singleline-html-element-content-newline": "off",
        "vue/html-self-closing": "off",
        "vue/require-component-is": "off",      // not allow is="style" https://github.com/vuejs/eslint-plugin-vue/issues/462#issuecomment-430234675
        "vue/attribute-hyphenation": "off",     // This change noNL to "no-n-l" unexpectedly
        "vue/multi-word-component-names": "off",
        "no-multi-spaces": [ "warn", {
            ignoreEOLComments: true,
        }],
        "array-bracket-spacing": [ "warn", "always", {
            "singleValue": true,
            "objectsInArrays": false,
            "arraysInArrays": false
        }],
        "space-before-function-paren": [ "warn", {
            "anonymous": "always",
            "named": "never",
            "asyncArrow": "always"
        }],
        "linebreak-style": ["warn", "unix"],
        "curly": "warn",
        "object-curly-spacing": [ "warn", "always" ],
        "object-curly-newline": "off",
        "object-property-newline": "warn",
        "comma-spacing": "warn",
        "brace-style": "warn",
        "no-var": "warn",
        "key-spacing": "warn",
        "keyword-spacing": "warn",
        "space-infix-ops": "warn",
        "arrow-spacing": "warn",
        "no-trailing-spaces": "warn",
        "no-constant-condition": [ "warn", {
            "checkLoops": false,
        }],
        "space-before-blocks": "warn",
        //'no-console': 'warn',
        "no-extra-boolean-cast": "off",
        "no-multiple-empty-lines": [ "warn", {
            "max": 1,
            "maxBOF": 0,
        }],
        "lines-between-class-members": [ "warn", "always", {
            exceptAfterSingleLine: true,
        }],
        "no-unneeded-ternary": "warn",
        "array-bracket-newline": [ "warn", "consistent" ],
        "eol-last": [ "warn", "always" ],
        //'prefer-template': 'error',
        "comma-dangle": [ "warn", "only-multiline" ],
        "no-empty": [ "warn", {
            "allowEmptyCatch": true
        }],
        "no-control-regex": "off",
        "one-var": [ "warn", "never" ],
        "max-statements-per-line": [ "warn", { "max": 1 }]
    },
    "overrides": [
        {
            "files": [ "src/languages/*.js", "src/icon.js" ],
            "rules": {
                "comma-dangle": [ "warn", "always-multiline" ],
            }
        },

        // Override for jest puppeteer
        {
            "files": [
                "**/*.spec.js",
                "**/*.spec.jsx"
            ],
            env: {
                jest: true,
            },
            globals: {
                page: true,
                browser: true,
                context: true,
                jestPuppeteer: true,
            },
        }
    ]
};
