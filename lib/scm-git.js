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
    libpath = require('path'),
    libprocess = require('child_process');



function SCMGit(base) {
    this.base = base;
}
module.exports = SCMGit;


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
    /*jshint boss:true */
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


