/*!
 *  MIT License
 *
 *  Copyright (C) 2012 Andrew Folta <drew@folta.net>
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a
 *  copy of this software and associated documentation files (the "Software"),
 *  to deal in the Software without restriction, including without limitation
 *  the rights to use, copy, modify, merge, publish, distribute, sublicense,
 *  and/or sell copies of the Software, and to permit persons to whom the
 *  Software is furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 *  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 *  DEALINGS IN THE SOFTWARE.
 */


var 
    libfs = require('fs'),
    libpath = require('path'),
    libsemver = require('semver'),

    OPS = {};



//------------------------------------------------------------------------
// utility functions

// merges changes into dest
function objectMerge(dest, changes) {
    // TODO
}


//------------------------------------------------------------------------
// base functionality common to all commands

function Base(options) {
    var configfile;

    this.options = options || {};

    // default config
    this.config = {
        target: '.',
        changelog: {
            file: 'Changelog.md',
            template: null,     // dynamically computed
            changes: {
                //TODO dateformat: 'TODO',
                filters: []
            },
            version: {
                //TODO dateformat: 'TODO',
                filters: []
            },
            database: 'TODO'
        }
    };

    // config file overlays defaults
    configfile = options.config || 'crank.json';
    objectMerge(this.config, this.fileReadJSON(configfile));
}


Base.prototype.fileReadJSON = function(path) {
    var content;
    if (! libpath.existsSync(path)) {
        return {};
    }
    content = libfs.readFileSync(path, 'utf-8');
    return JSON.parse(content);
}


Base.prototype.fileWriteJSON = function(path, content) {
    var content;
    if (! libpath.existsSync(path)) {
        return {};
    }
    content = JSON.stringify(content, null, 4);
    return libfs.writeFileSync(path, content, 'utf-8');
}



//------------------------------------------------------------------------
// crank the version number

function OPVersion(base) {
    this.base = base;
}
OPS.version = OPVersion;


OPVersion.description = 'increments version number';


// no options right now
OPVersion.options = {};


OPVersion.prototype.usage = function(command) {
    // TODO
};


OPVersion.prototype.run = function(command) {
    var pkgPath, pkg, inc;
    pkgPath = libpath.join(this.base.config.target, 'package.json');
    pkg = this.base.fileReadJSON(pkgPath);
    inc = command.args[0] || 'patch';
    pkg.version = libsemver.inc(pkg.version, inc);
    if (! pkg.version) {
        command.error = {
            type: 'ARG_INVALID',
            argPosition: 0,
            argValue: inc,
            argExpected: ['major', 'minor', 'patch']
        };
        usage(command);
        return;
    }
    this.base.fileWriteJSON(pkgPath, pkg);
    console.log(pkg.version + ' ' + pkgPath);
};



//------------------------------------------------------------------------
// main public API

function parseArgs(args) {
    var arg, command;
    command = {
        args: [],
        options: {},
        globalOptions: {}
    };
    // TODO -- use definitions for both global and command-specific options
    while (args.length) {
        arg = args.shift();

        if ('--' === arg.substr(0, 2)) {
            arg = arg.substr(2);
            if (command.op) {
                command.options[arg] = args.shift();
            }
            else {
                command.globalOptions[arg] = args.shift();
            }
            continue;
        }

        if (! command.op) {
            command.op = arg;
            continue;
        }
        command.args.push(arg);
    }
    return command;
}


function error(error) {
    // TODO
    console.log('--ERROR--');
    console.error(error);
    console.log();
}


function usage(command) {
    var base, op;
    if (command.error) {
        error(command.error);
    }

    if (command.op) {
        base = new Base(command.globalOptions);
        op = new OPS[command.op](base);
        op.usage(command);
    }
    else {
        console.log(
            'USAGE:  crank {global-options} {command} {command-options}\n'
            +  '\n'
            +  'GLOBAL OPTIONS\n'
            +  '    --config {file}     which config file to use\n'
            +  '                        (defaults to config.json)\n'
            +  '\n'
            +  'COMMANDS');
        for (op in OPS) {
            console.log('    ' + op + '    ' + OPS[op].description);
        }
        console.log();
    }

    process.exit(command.error ? 1 : 0);
}


function run(command) {
    var base, ctor, op;

    if (! command.op) {
        this.usage(command);
        return;
    }
    if (command.error) {
        this.usage(command);
        return;
    }

    if (command.globalOptions.help) {
        usage(command);
        return;
    }

    base = new Base(command.globalOptions);
    ctor = OPS[command.op];
    if (! ctor) {
        command.error = {
            type: 'ARG_INVALID',
            argPosition: 0,
            argValue: command.op,
            argExpected: Object.keys(OPS)
        };
        delete command.op;
        usage(command);
        return;
    }
    op = new ctor(base);
    op.run(command);
}


module.exports = {
    parseArgs: parseArgs,
    usage: usage,
    run: run
};


