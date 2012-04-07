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
    libprocess = require('child_process'),
    libsemver = require('semver'),

    OPS = {},
    SCMS = {};



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
            },
            database: {
                type: 'regexp',
                file: 'Changelog.md',
                regexp: '\\bversion\\s+([0-9.]+)[\\s\\S]*?\\bchange\\s+(\\S+)'
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
    // duck typing methods:
    //  * init(target)
    //      returns false if SCM doesn't apply
    //  * getCurrentChangeID(cb(error,changeID))
    //      returns the current change ID of the target
    //  * listChanges(fromChange, toChange, cb(error,list))
    //      returns changes as array, skipping fromChange including toCHange


    //--------------------------------------------------------
    // git
    function SCMGit(base) {
        this.base = base;
    }
    SCMS.git = SCMGit;


    SCMGit.prototype.init = function(target) {
        var parts, i, path, repo;
        if ('/' !== target.substring(0, 1)) {
            target = libpath.join(process.cwd(), target);
        }
        parts = target.split('/');
        parts.shift();  // empty part before the first slash
        for (i = parts.length; i > 0; i--) {
            // TODO -- use libpath
            path = '/' + parts.slice(0, i).join('/');
            repo = libpath.join(path, '.git');
            if (libpath.existsSync(repo)) {
                this.target = target;
                this.repo = repo;
                return true;
            }
        }
        return false;
    };


    SCMGit.prototype.getCurrentChangeID = function(cb) {
        this._readRef('HEAD', cb);
    };


    SCMGit.prototype.listChanges = function(fromChange, toChange, cb) {
        var me = this, cmd;
        cmd = 'git log --pretty=raw --date-order ' + fromChange + '..' + toChange + ' ' + this.target;
        libprocess.exec(cmd, function(error, stdout, stderr) {
            if (error) {
                cb(error);
                return;
            }
            cb(null, me._parseLog(stdout));
        });
    };


    SCMGit.prototype._readRef = function(ref, cb) {
        var change;
        var matches;
        change = this.base.fileRead(libpath.join(this.repo, ref));
        if (matches = change.match(/ref: (\S+)/)) {
            this._readRef(matches[1], cb);
            return;
        }
        cb(null, change.trim());
    };


    SCMGit.prototype._parseLog = function(raw) {
        var lines, i, line, lineParts,
            currentCommit = { message:[] },
            changes = [];
        lines = raw.split('\n');

        // also converts to crank format
        function saveCurrentCommit() {
            var crank = {},
                who, whoParts, whoTime;

            who = currentCommit.committer || currentCommit.author;
            whoParts = who.split(' ');
            whoParts.pop(); // timezone offset
            whoTime = whoParts.pop();
            who = whoParts.join(' ');

            // convert into crank format
            crank.changeid = currentCommit.commit;
            // FUTURE:  support full message (probably a new config flag)
            crank.message = currentCommit.message[0];
            crank.author = who;
            crank.date = new Date(parseInt(whoTime,10) * 1000);

            changes.push(crank);
            currentCommit = { message:[] };
        }

        for (i = 0; i < lines.length; i++) {
            line = lines[i];
            if (! line) {
                continue;
            }
            lineParts = line.split(' ');
            if ('' === lineParts[0]) {
                currentCommit.message.push(line.substr(4));
                continue;
            }
            if ('commit' === lineParts[0] && currentCommit.commit) {
                saveCurrentCommit();
            }
            currentCommit[lineParts.shift()] = lineParts.join(' ');
        }
        if (currentCommit.commit) {
            saveCurrentCommit();
        }
        return changes;
    };


    //--------------------------------------------------------
    // svn
    function SCMSvn() {}
    SCMS.svn = SCMSvn;


    SCMSvn.prototype.init = function(target) {
        // TODO
        return false;
    };


    SCMSvn.prototype.getCurrentChangeID = function(cb) {
        // TODO
    };


    SCMSvn.prototype.listChanges = function(fromChange, toChange, cb) {
        // TODO
    };



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
// crank the changelog
OPS.changelog = require(libpath.join(__dirname, 'op-changelog.js'));



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


