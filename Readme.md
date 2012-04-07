
# CRANK

a tool to update version number and changelog, for npm module development


## usage

    crank version {part}
        increments version in package.json
        {part} is `major`, `minor`, or `patch`.  defaults to `patch`

    crank changelog Changelog.md
        updates changelog


## intentions

<dl>
    <dt><b>node modules</b></dt>
    <dd>
        Used to manage node modules.  (Assumes package.json, etc.)
    </dd>
    <dt><b>move into the future</b></dt>
    <dd>
        Interface designed primarily to increment/update package metadata.
    </dd>
    <dt><b>for build systems</b></dt>
    <dd>
        Intended to use in a build system (gmake, ant, phing, etc).
        Expects to be intermixed with other commands.
        (This lets it focus on what it does well -- and not try to do everything.)
    </dd>
    <dt><b>semantic versioning</b></dt>
    <dd>
        By default, makes it easy to manage packages that use <a href="http://semver.org/">semantic versioning</a>.
    </dd>
    <dt><b>read-only</b></dt>
    <dd>
        Doesn't commit to the SCM.  (See "not try to do everything" above.)
    </dd>
    <dt><b>config file (optional)</b></dt>
    <dd>
        Options given mainly by config file (instead of commandline arguments).
        This makes it easier to create re-usable "recipes".
        (For example, using a config file means that it can be commited to the SCM.)
    </dd>
    <dt><b></b></dt>
    <dd>
    </dd>
</dl>


## assumptions

<dl>
    <dt><b>single change ID</b></dt>
    <dd>
        Change ID ("revision", "commit", etc) of target diretory applies homogeneously to all files/subdirectories in the target.
    </dd>
    <dt><b>clean target</b></dt>
    <dd>
        No modified files in the target directory.
    </dd>
    <dt><b>CWD in module root</b></dt>
    <dd>
        Generally expected to be run in same directory as package.json.
    </dd>
    <dt><b></b></dt>
    <dd>
    </dd>
</dl>


## config

* not really needed for simple use cases
* defaults to `crank.json` in the current working directory
* can be specified with a commandline argument

* `target`:  directory to track
    * defaults to current working directory
* `changelog`:
    * `file`:     path on disk
        * relative path is relative to the target
    * `template`: template type, or path on disk
        * defaults to file extension
        * simple string taken as one of the built-in template types to use
            * builtin types are "md" (markdown) and "txt" (plain text)
        * otherwise, template to use
    * `changes`:
        * `dateformat`: string
            * format to use for change dates
        * `filters`:  list of regexes to modify changes
            * `subject`: "message", "author", "date", "changeid"
            * `regexp`: string
            * `replace`: "string"
                * if results in "--CRANK:SKIP--" then change is skipped
    * `versions`:
        * `dateformat`: string
            * format to use for revision dates
        * `filters`:  list of regeses to modify versions
            * `subject`: "version", "date", "changes"
            * `regexp`: string
            * `replace`: "string"
                * if results in "--CRANK:SKIP--" then version is skipped
* `database` -- TODO
    * maps version:changeid
    * only really needed by `crank changelog`
    * types
        * `file {foo.json}`
            * separate json file
        * `changelog`
            * uses changelog file itself to find version:changeid pairs
            * TODO:  need way to pull pairs out of changelog (regexp?)
        * `scm-changes`
            * uses SCM change log to find version:changeid pairs
            * TODO:  need way to pull pairs out of SCM change log


## template

* good old mustache

* `{{version}}` string
* `{{date}}` string, date that crank was run
* `{{changeid}}` string
* `{{changes}}` list of objects
    * `{{changeid}}` string
    * `{{date}}` string
    * `{{author}}` string
    * `{{message}}` string


## license

MIT License

Copyright (C) 2012 Andrew Folta <drew@folta.net>

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.


