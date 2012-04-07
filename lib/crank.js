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
    libasync = require('async'),
    libdateformat = require('dateformat'),
    libfs = require('fs'),
    libmu = require('mu2'),
    libpath = require('path'),
    libprocess = require('child_process'),
    libsemver = require('semver'),

    OPS = {},
    SCMS = {},
    CHANGELOG_DBS = {};



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


Base.prototype.dateFormat = function(date, format) {
    return libdateformat(date, format);
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

function OPChangelog(base) {
    this.base = base;
    if (! this.base.config.changelog.template) {
        this.base.config.changelog.template =
            libpath.extname(this.base.config.changelog.file).substr(1);
    }
}
OPS.changelog = OPChangelog;


OPChangelog.description = 'updates changelog with latest changes';


// no options right now
OPChangelog.options = {};


OPChangelog.prototype.usage = function(command) {
    // TODO
};


OPChangelog.prototype.run = function(command) {
    var me = this,
        db,
        mapVersionChange,
        currentChangeID,
        latestChangeID,
        changes,
        latestVersion,
        rendered = '';

    db = makeChangelogDB(this.base, this.base.config.changelog.database);

    libasync.series([

        // read db
        function step1(cb) {
            db.read(function(error, map) {
                if (error) {
                    cb(error);
                    return;
                }
                mapVersionChange = map;
                cb();
            });
        },

        // get changeid of target
        function step2(cb) {
            me.base.scmGetCurrentChangeID(function(error, changeid) {
                if (error) {
                    cb(error);
                    return;
                }
                currentChangeID = changeid;
                // if exists in db, bail:done
                if (mapVersionChange[currentChangeID]) {
                    return;
                }
                cb();
            });
        },

        // get latest changeid in db
        function step3(cb) {
            latestChangeID = mapVersionChange[Object.keys(mapVersionChange)[0]];
            if (currentChangeID === latestChangeID) {
                console.log('NOTICE:  no changes since last crank.  done..');
                return;
            }
            cb();
        },

        // list log entries from last-rev to current-rev
        function step4(cb) {
            me.base.scmListChanges(latestChangeID, currentChangeID, function(error, list) {
                if (error) {
                    cb(error);
                    return;
                }
                changes = list;
                cb();
            });
        },

        // get latest version
        function step5(cb) {
            var pkgPath, pkg;
            pkgPath = libpath.join(me.base.config.target, 'package.json');
            pkg = me.base.fileReadJSON(pkgPath);
            latestVersion = pkg.version;
            if (mapVersionChange[latestVersion]) {
                console.log('NOTICE:  version ' + latestVersion + ' already recorded');
                return;
            }
            cb();
        },

        // filter/transform/templatize changes
        function step6(cb) {
            var release = {}, releases, template;

            changes = me.base.filter(changes,
                    me.base.config.changelog.changes.filters);
            changes.forEach(function(change) {
                change.date = me.base.dateFormat(change.date,
                        me.base.config.changelog.changes.dateformat);
            });

            release = {
                version:  latestVersion,
                date:     me.base.dateFormat(new Date(),
                                me.base.config.changelog.versions.dateformat),
                changeid: currentChangeID,
                changes:  changes
            };
            releases = [ release ];
            releases = me.base.filter(releases,
                    me.base.config.changelog.versions.filters);
            release = releases[0];

            template = libpath.join(__dirname, '..', 'templates-changelog',
                    me.base.config.changelog.template + '.mu');
            libmu.compileAndRender(template, release)
                .on('error', function(error) {
                    cb(error);
                })
                .on('data', function(data) {
                    rendered += data.toString();
                })
                .on('end', function() {
                    cb();
                });
        },

        // update changelog
        function step7(cb) {
            var content;
            content = me.base.fileRead(me.base.config.changelog.file);
            content = rendered + content;
            me.base.fileWrite(me.base.config.changelog.file, content);
            cb();
        },

        // update db
        function step8(cb) {
            db.update(latestVersion, latestChangeID, cb);
        },

    ]);
};


    //--------------------------------------------------------
    // changelog database
    function makeChangelogDB(base, config) {
        return new CHANGELOG_DBS[config.type](base, config);
    }
    // duck typing methods:
    //  * read(cb(error,db))
    //      returns an array of pairs (TODO:  what is a pair)
    //  * update(version, change, db(error))
    //      returns success as boolean


    //--------------------------------------------------------
    // data stored in changelog, pulled out via RegExps
    function ChangelogDBRegexp(base, config) {
        this.base = base;
        this.config = config;
        this.regexp = new RegExp(config.regexp, 'g');
    }
    CHANGELOG_DBS.regexp = ChangelogDBRegexp;


    ChangelogDBRegexp.prototype.read = function(cb) {
        var content, matches, db = {};
        content = this.base.fileRead(this.config.file);
        while (matches = this.regexp.exec(content)) {
            db[matches[1]] = matches[2];
        }
        cb(null, db);
    };


    ChangelogDBRegexp.prototype.update = function(version, change, cb) {
        // noop because the info has already been written to the changelog file
        cb();
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
            +  '                        (defaults to config.json)\n'
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


