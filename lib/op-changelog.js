/*!
 *  MIT License
 *
 *  Copyright (c) 2012, Yahoo! Inc.  All rights reserved.
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
    libmu = require('mu2'),
    libpath = require('path'),
    libxregexp = require('xregexp').XRegExp;



//------------------------------------------------------------------------
// crank the changelog

function OPChangelog(base) {
    this.base = base;
    if ('/' !== this.base.config.changelog.file.substr(0, 1)) {
        this.base.config.changelog.file = libpath.join(this.base.config.target, this.base.config.changelog.file);
    }
    if (! this.base.config.changelog.template) {
        this.base.config.changelog.template =
            libpath.extname(this.base.config.changelog.file).substr(1);
    }
    this.template = new Template(base);
}
module.exports = OPChangelog;


OPChangelog.description = 'updates changelog with latest changes';


// no options right now
OPChangelog.options = {};


OPChangelog.prototype.usage = function(command) {
    console.log(
        'USAGE:  crank changelog {file}' +
        '\n'+
        '\n    updates the changelog in the file' +
        '\n    {file} is optional if it\'s specified in the crank.json config file' +
        '\n' +
        '\n    The changelog is first read to which change (git commit or svn revision)' +
        '\n    has already been recorded there.  Then all changes since then are found '+
        '\n    and added to the changelog, using the version number found in package.json.' +
        '\n');
};


OPChangelog.prototype.run = function(command) {
    var me = this,
        mapVersionChange,
        currentChangeID,
        latestChangeID,
        changes,
        skipEmpty,
        latestVersion,
        rendered = '';

    if (command.args[0]) {
        this.base.config.changelog.file = command.args.shift();
    }

    skipEmpty = me.base.config.changelog.releases && me.base.config.changelog.releases.skipEmpty;

    libasync.series([

        // read db
        function step1(cb) {
            me._readChangelog(function(error, map) {
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
                console.log('NOTICE:  no changes since last crank.  done.');
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
            var release, releases;

            changes = me.base.filter(changes,
                    me.base.config.changelog.changes.filters);
            if (!changes.length && skipEmpty) {
                console.log('NOTICE:  skipped empty release ' + latestVersion);
                return;
            }
                me.base.config.changelog.releases
            changes.forEach(function(change) {
                change.date = libdateformat(change.date,
                        me.base.config.changelog.changes.dateformat);
            });

            release = {
                version:  latestVersion,
                date:     libdateformat(new Date(),
                                me.base.config.changelog.versions.dateformat),
                changeid: currentChangeID,
                changes:  changes
            };
            releases = [ release ];
            releases = me.base.filter(releases,
                    me.base.config.changelog.versions.filters);
            release = releases[0];

            me.template.renderVersion(release, function(error, content) {
                if (error) {
                    cb(error);
                    return;
                }
                rendered = content;
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
        }

    ], function(error) {
        if (error) {
            console.error('ERROR: ' + error.message);
            return;
        }
    });
};


OPChangelog.prototype._readChangelog = function(cb) {
    var content, versions, version, i,
        db = {};

    content = this.base.fileRead(this.base.config.changelog.file);
    versions = this.template.parseChangelog(content);

    for (i = 0; i < versions.length; i++) {
        version = versions[i];
        db[version.version] = version.changeid;
    }
    cb(null, db);
};



//--------------------------------------------------------
// abstraction over template, since we need to do some
// funky things

function Template(base) {
    this.base = base;
    this._load();
}


Template.prototype.parseChangelog = function(changelog) {
    /*jshint boss:true */
    var tokenized, regexp,
        names = {}, idx = 1,
        matches,
        versions = [], version;

    // This makes a RegExp out of the template, and uses that to match against
    // the changelog.  The generated RegExp is only approximately able to parse
    // the formatted string (changelog), but it's good enough to pull out the
    // things we care about ({{version}} and {{changeid}}).

    tokenized = this.content.replace(/\{\{#([^}]+)\}\}[\s\S]*?\{\{\/\1\}\}/, ':CRANK:$1:');
    tokenized = tokenized.replace(/\{\{^([^}]+)\}\}[\s\S]*?\{\{\/\1\}\}/, ':CRANK:no-$1:');
    tokenized = tokenized.replace(/\{?\{\{([^}]*)\}\}\}?/g, ':CRANK:$1:');

    regexp = libxregexp.escape(tokenized);
    while (matches = regexp.match(/:CRANK:([a-z]+):/)) {
        // FUTURE:  This doesn't capture all of {{changes}}.
        // That's hard to do since it needs to only go up to the end of the
        // version, and not match into the next version.  (It's doable, but
        // tricky since the template could be user-defined, and thus we can't
        // make any assumptions about its structure.)
        regexp = regexp.replace(matches[0], '([\\s\\S]*?)');
        names[idx] = matches[1];
        idx++;
    }
    regexp = new RegExp(regexp, 'g');

    while (matches = regexp.exec(changelog)) {
        version = {};
        for (idx in names) {
            if (names.hasOwnProperty(idx)) {
                version[names[idx]] = matches[idx];
            }
        }
        versions.push(version);
    }
    return versions;
};


Template.prototype.renderVersion = function(data, cb) {
    var rendered = '';
    libmu.renderText(this.content, data)
        .on('error', function(error) {
            cb(error);
        })
        .on('data', function(data) {
            rendered += data.toString();
        })
        .on('end', function() {
            cb(null, rendered);
        });
};


Template.prototype._load = function() {
    var path;
    path = libpath.join(__dirname, '..', 'templates-changelog',
            this.base.config.changelog.template + '.mu');
    this.content = this.base.fileRead(path);
};


