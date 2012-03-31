
# CRANK

a tool to update version number and changelog, for npm module development


# usage

    crank version {part}
        increments version in package.json
        {part} is "major", "minor", or "patch".  defaults to "patch"

    crank changelog Changelog.md
        updates changelog


# intentions

    * used to manage a node module
        * assumes package.json
    * primarily to move forward into the future
    * used in a build system (gmake, ant, phing, etc)
        * expected to be used intermixed with other commands
        * focuses on what it does well
        * doesn't try to do everything
    * follows semantic versioning approach
    * read-only:  doesn't commits files
    * can use a "config" or "recipe" file for advanced use cases


# assumptions

    * change ID ("revision", "commit", etc) of target applies homogeneously to all files/subdirs in target
    * target is "clean" -- no modifications
    * generally expected to be run when in same directory as package.json


# config

    * not really needed for simple use cases
    * defaults to "crank.json" in the current working directory
    * can be specified with a commandline argument

    * target:  directory to track
        * defaults to current working directory
    * changelog:
        * file:     path on disk
            * relative path is relative to the target
        * template: template type, or path on disk
            * defaults to file extension
            * simple string taken as one of the built-in template types to use
                * builtin types are "md" (markdown) and "txt" (plain text)
            * otherwise, template to use
        * changes:
            * dateformat: string
                * format to use for change dates
            * filters:  list of regexes to modify changes
                * subject: "message", "author", "date", "changeid"
                * regex: string
                * replace: "string"
                    * if results in "--CRANK:SKIP--" then change is skipped
        * versions:
            * dateformat: string
                * format to use for revision dates
            * filters:  list of regeses to modify versions
                * subject: "version", "date"
                * regex: string
                * replace: "string"
                    * if results in "--CRANK:SKIP--" then version is skipped
    * database -- TODO
        * maps version:changeid
        * only really needed by `crank changelog`
        * types
            * file {foo.json}
                * separate json file
            * changelog
                * uses changelog file itself to find version:changeid pairs
                * TODO:  need way to pull pairs out of changelog (regex?)
            * vcs-changes
                * uses vcs change log to find version:changeid pairs
                * TODO:  need way to pull pairs out of vcs change log


# TEMPLATE

    * good old mustache

    * {{version}} string
    * {{date}} string
    * {{crankdate}} string, date that crank was run
    * {{changes}} list
        * {{changeid}} string
        * {{date}} string
        * {{author}} string
        * {{message}} string


# TODO

    * how do we order log entries?
        * presumably just use the order returned by the vcs
            but is there more to it than that?
    * do we need to order versions?
    * ... or otherwise compare version numbers?
    * templates can have dates (of version or entry)
        * ... gotten from vcs?
    * log entry templates can have changeids
    * encorporate ideas from https://github.com/ccare/node-release-utils
    * "crank release" does all that's needed (inc commits)


# license

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


