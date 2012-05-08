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
    libpath = require('path'),
    libprocess = require('child_process');



function SCMSvn(base) {}
module.exports = SCMSvn;


SCMSvn.prototype.init = function(target, cb) {
    var path = libpath.join(target, '.svn');
    if (libpath.existsSync(path)) {
        this.target = target;
        cb(null, this);
        return;
    }
    cb(null, null);
};


SCMSvn.prototype.getCurrentChangeID = function(cb) {
    var me = this;
    libprocess.exec('svn info', function(error, stdout, stderr) {
        var info;
        if (error) {
            cb(error);
            return;
        }
        info = me._parseInfo(stdout);
        cb(null, info['Revision']);
    });
};


SCMSvn.prototype.listChanges = function(fromChange, toChange, cb) {
    var me = this,
        cmd, log;
    fromChange = parseInt(fromChange, 10);
    // reverse order, so that changelog "reads up"
    cmd = 'svn log -r ' + toChange + ':' + (fromChange + 1);
    libprocess.exec(cmd, function(error, stdout, stderr) {
        if (error) {
            cb(error);
            return;
        }
        log = me._parseLog(stdout);
        cb(null, log);
    });
};


SCMSvn.prototype._parseInfo = function(raw) {
    var info = {},
        l, line, lines,
        sepPos, key;
    lines = raw.split('\n');
    for (l = 0; l < lines.length; l += 1) {
        line = lines[l];
        if (!line.length) {
            continue;
        }
        sepPos = line.indexOf(': ');
        if (-1 === sepPos) {
            continue;
        }
        key = line.substr(0, sepPos);
        info[key] = line.substr(sepPos + 2);
    }
    return info;
};


SCMSvn.prototype._parseLog = function(raw) {
    var changes = [],
        e, entry, entries,
        lines, matches, crank;
    entries = raw.split(/------------------------------------+\n/m);
    for (e = 0; e < entries.length; e++) {
        entry = entries[e].trim();
        if (!entry.length) {
            continue;
        }
        lines = entry.split('\n');
        // r14611 | jcatera | 2012-05-08 09:45:20 -0700 (Tue, 08 May 2012) | 2 lines
        matches = lines[0].match(/^r(\d+)\s+\|\s+(\S+)\s+\|\s+([^|]+)\s+|/);
        lines.shift();
        lines.shift();
        crank = {};
        crank.changeid = matches[1];
        crank.author = matches[2];
        crank.date = new Date(matches[3]);
        crank.message = lines.join('\n');
        changes.push(crank);
    }
    return changes;
};



