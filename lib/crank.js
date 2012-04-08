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

    OPS = {},
    SCMS = {};



//------------------------------------------------------------------------
// externally-loaded components

OPS.changelog = require(libpath.join(__dirname, 'op-changelog.js'));

SCMS.git = require(libpath.join(__dirname, 'scm-git.js'));
SCMS.svn = require(libpath.join(__dirname, 'scm-svn.js'));



//------------------------------------------------------------------------
// utility functions

// merges changes into dest
function objectMerge(dest, changes) {
    // TODO
}


function stringPadLeft(len, str) {
    var xtra = len - str.length;
    if (xtra <= 0) {
        return str;
    }
    return str + Array(xtra + 1).join(' ');
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
                dateformat: 'default',
                filters: []
            },
            versions: {
                dateformat: 'default',
                filters: []
            }
        }
    };

    // config file overlays defaults
    configfile = options.config || 'crank.json';
    objectMerge(this.config, this.fileReadJSON(configfile));
}


Base.prototype.fileRead = function(path) {
    var content;
    if (! libpath.existsSync(path)) {
        return null;
    }
    return libfs.readFileSync(path, 'utf-8');
};


Base.prototype.fileReadJSON = function(path) {
    var content;
    if (! libpath.existsSync(path)) {
        return {};
    }
    content = libfs.readFileSync(path, 'utf-8');
    return JSON.parse(content);
};


Base.prototype.fileWrite = function(path, content) {
    return libfs.writeFileSync(path, content, 'utf-8');
};


Base.prototype.fileWriteJSON = function(path, content) {
    content = JSON.stringify(content, null, 4);
    return libfs.writeFileSync(path, content, 'utf-8');
};


// filter a list of JSON structures
Base.prototype.filter = function(list, filters) {
    if (! filters.length) {
        // nothing to do
        return list;
    }
    // TODO
    return list;
};


Base.prototype.scmGetCurrentChangeID = function(cb) {
    var me = this;
    this._scmInit(function(error) {
        if (error) {
            cb(error);
        }
        else {
            me._scm.getCurrentChangeID(cb);
        }
    });
};


Base.prototype.scmListChanges = function(fromChange, toChange, cb) {
    var me = this;
    this._scmInit(function(error) {
        if (error) {
            cb(error);
        }
        else {
            me._scm.listChanges(fromChange, toChange, cb);
        }
    });
};


Base.prototype._scmInit = function(cb) {
    var i, scm;
    if (this._scm) {
        cb(null);
        return;
    }
    for (i in SCMS) {
        if (SCMS.hasOwnProperty(i)) {
            scm = new SCMS[i](this);
            // TODO:  make this interface async as well
            if (scm.init(this.config.target)) {
                this._scm = scm;
                cb(null);
                return;
            }
        }
    }
    cb(new Error('FAILED to find suitable SCM'));
};


    //--------------------------------------------------------
    // changelog scms
    // duck typed methods:
    //
    //  * init(target)
    //      returns false if SCM doesn't apply
    //
    //  * getCurrentChangeID(cb(error,changeID))
    //      returns the current change ID of the target
    //
    //  * listChanges(fromChange, toChange, cb(error,list))
    //      returns changes as array, skipping fromChange including toChange



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
    // FUTURE:  use definitions for both global and command-specific options
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
    var base, op, max;
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
            +  '                        (defaults to crank.json)\n'
            +  '\n'
            +  'COMMANDS');
        max = 0;
        for (op in OPS) {
            if (OPS.hasOwnProperty(op)) {
                max = Math.max(max, op.length);
            }
        }
        for (op in OPS) {
            if (OPS.hasOwnProperty(op)) {
                console.log('    ' + stringPadLeft(max, op) + '    ' + OPS[op].description);
            }
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


