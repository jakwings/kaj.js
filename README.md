# Status

Welcome to fork. But no full documentation now...

# Setup

    npm install

    # Build kaj.js for browsers.
    npm install -g browserify
    browserify lib/kaj.browser.js -o kaj.min.js

# Intro

Options:

* `kaj.options`

Classes:

* `kaj.BlockLexer`
* `kaj.InlineLexer`
* `kaj.Renderer`
* `kaj.Tnode`

Methods:

* `kaj(src, options)`
* `kaj.setDirective`
* `kaj.setRole`