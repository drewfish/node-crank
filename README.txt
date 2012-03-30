CRANK
    a tool to update version numbers and changelogs, for npm module development


USAGE
    crank version {part}
        increments version in package.json
        {part} is "major", "minor", or "patch".  defaults to "patch"

    crank changelog Changelog.md
        updates changelog


INTENTIONS
    * used to manage a node module
        * assumes package.json
    * primarily to move forward into the future
    * used in a build system (gmake, ant, phing, etc)
        * expected to be used intermixed with other commands
        * focuses on what it does well
        * doesn't try to do everything
    * follows semantic versions
    * read-only:  doesn't commits files
    * uses a "config" or "recipe" file


ASSUMPTIONS
    * change ID ("revision", "commit", etc) of target applies homogeneously to all files/subdirs in target
    * target is "clean" -- no modifications
    * generally expected to be run when in same directory as package.json


CONFIG
    * not really needed if only using `crank version` and semantic versions
    * defaults to "crank.json" in the cwd

    * target:  directory to track
        * defaults to cwd
    * changelog:
        * file:     path on disk
            * relative path is relative to the target
        * formats:   template format (e.g. "md", "txt")
            * changedate:  string
                * format to use for change dates
            * versiondate:  string
                * format to use for version dates
        * template: template type, or path on disk
            * defaults to file extension
            * simple string taken as one of the built-in template types to use
            * otherwise, template to use
        * changes:
            * filters:  list of regexes to modify changes
                * subject: "message", "author", "date", "changeid"
                * regex: string
                * replace: "string"
                    * if results in "--CRANK:SKIP--" then change is skipped
        * versions:
            * filters:  list of regeses to modify versions
                * subject: "version", "date"
                * regex: string
                * replace: "string"
                    * if results in "--CRANK:SKIP--" then version is skipped
    * database -- TODO
        * maps version:changeid
        * types
            * file {foo.json}
                * separate json file
            * changelog
                * uses changelog file itself to find version:changeid pairs
                * TODO:  need way to pull pairs out of changelog (regex?)
            * vcs-changes
                * uses vcs change log to find version:changeid pairs
                * TODO:  need way to pull pairs out of vcs change log


TEMPLATE
    * good old mustache

    * {{version}} string
    * {{date}} string
    * {{crankdate}} string, date that crank was run
    * {{changes}} list
        * {{changeid}} string
        * {{date}} string
        * {{author}} string
        * {{message}} string


TODO
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


