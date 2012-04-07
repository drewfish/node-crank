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
    libmu = require('mu2'),
    libpath = require('path'),

    CHANGELOG_DBS = {};



//------------------------------------------------------------------------
// crank the changelog

function OPChangelog(base) {
    this.base = base;
    if (! this.base.config.changelog.template) {
        this.base.config.changelog.template =
            libpath.extname(this.base.config.changelog.file).substr(1);
    }
}
module.exports = OPChangelog;


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



