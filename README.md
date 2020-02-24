# Introduction
Are you tired of pushing commits to test your Gitlab CI?

Then this is the tool for you.

It lets you simulate a CI pipeline on your local machine.

# Table of contents
   * [Introduction](#introduction)
   * [Table of contents](#table-of-contents)
   * [Installation](#installation)
      * [Linux](#linux)
      * [Windows (Git bash)](#windows-git-bash)
      * [Macos](#macos)
   * [Usage](#usage)
      * [Example](#example)
      * [Convinience](#convinience)
         * [Bash alias](#bash-alias)
         * [Bash completion](#bash-completion)
      * [Quicks](#quirks)
         * [Artifacts](#artifacts)
   * [Development](#development)
      * [Scripts](#scripts)
      * [Build binaries](#build-binaries)
   * [TODO](#todo)
      * [Known Bugs](#known-bugs)
      * [Features](#features)
      * [Unsupported tags, will be implemented in order](#unsupported-tags-will-be-implemented-in-order)
      * [Docker specfic tags. (Only shell working now)](#docker-specfic-tags-only-shell-working-now)
      * [Gitlab CI only, will not be used by gitlab-ci-local](#gitlab-ci-only-will-not-be-used-by-gitlab-ci-local)
      * [Undecided](#undecided)

# Installation
## Linux
Download and put binary in `/usr/bin`

    $ sudo su `must be installed as root, if placed in /usr/bin/`
    $ curl -L https://github.com/firecow/gitlab-ci-local/releases/latest/download/linux.gz | gunzip -c > /usr/bin/gitlab-ci-local
    $ chmod +x /usr/bin/gitlab-ci-local
    
## Windows (Git bash)
Install [gitbash](https://git-scm.com/downloads)

Download and put binary in `C:\Program Files\Git\mingw64\bin`

    $ curl -L https://github.com/firecow/gitlab-ci-local/releases/latest/download/win.gz | gunzip -c > /c/Program\ Files/Git/mingw64/bin/gitlab-ci-local.exe

## Macos
TODO: Fill this

# Usage
## Example
    $ cd /home/user/workspace/myproject
    $ gitlab-ci-local

## Convinience
### Bash alias
    $ echo "alias gcl='gitlab-ci-local'" >> ~/.bashrc
### Bash completion
TODO: Fill this

## Quirks
### Artifacts
Artifacts works right now, as along as you don't overwrite tracked files and as long as you don't use dependencies tag.

# Development
## Scripts

    $ npm run build
    $ node -r source-map-support/register dist/index.js --cwd /home/user/workspace/project-folder/

![Alt text](/docs/images/development.png "Development output")

## Build binaries
    $ npm run build-linux
    $ npm run build-win
    $ npm run build-macos
    $ npm run build-all

# TODO

## Known Bugs
- include:local isn't recursive

## Features
- Only show output in cli, if -v and/or -vv have been passed as argument
- Configure gitlab-ci-local per project via .gitlab-ci.local/config.yml
- Verbosity on .gitlab-ci.local.yml overrides and appends.
- Different color when printing `when:{{value}}`.

## Unsupported tags, will be implemented in order
- rules
- when:always
- when:on_failure
- when:delayed
  - start_in (Used only with when:delayed)
- include:file
- include:template
- include:remote
- coverage (code coverage)
- retry (in case of failure)
- timeout (job max execution time)

## Docker specfic tags. (Only shell working now)
- services
- image

## Gitlab CI only, will not be used by gitlab-ci-local
- cache
- pages
- resource_group
- interruptible
- environment

## Undecided
- artifacts (reset/restore/uploads "files" from job to job)
- dependencies (depend or non-depend on artifacts, default is depend ALL)
- only
- except
- parallel
- trigger
