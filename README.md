# Introduction
Are you tired of pushing to test your .gitlab-ci.yml?

Then this is the tool for you.

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
      * [Features](#features)
      * [Unsupported tags, will be implemented in order](#unsupported-tags-will-be-implemented-in-order)
      * [Docker specfic tags. (Only shell working now)](#docker-specfic-tags-only-shell-working-now)
      * [Gitlab CI only, will not be used by gitlab-runner-local](#gitlab-ci-only-will-not-be-used-by-gitlab-runner-local)
      * [Undecided](#undecided)

# Installation
## Linux
Download and put binary in `/usr/bin`

    $ sudo su `must be installed as root, if placed in /usr/bin/`
    $ curl -L https://github.com/firecow/gitlab-runner-local/releases/latest/download/linux.gz | gunzip -c > /usr/bin/gitlab-runner-local
    $ chmod +x /usr/bin/gitlab-runner-local
    
## Windows (Git bash)
Install [gitbash](https://git-scm.com/downloads)

Download and put binary in `C:\Program Files\Git\mingw64\bin`

    $ curl -L https://github.com/firecow/gitlab-runner-local/releases/latest/download/win.gz | gunzip -c > /c/Program\ Files/Git/mingw64/bin/gitlab-runner-local.exe

## Macos
TODO: Fill this

# Usage
## Example
    $ cd /home/user/workspace/myproject
    $ gitlab-runner-local

## Convinience
### Bash alias
    $ echo "alias grl='gitlab-runner-local'" >> ~/.bashrc
### Bash completion
TODO: Fill this

## Quirks
### Artifacts
Artifacts works right now, as along as you don't overwirte git tracked files and as long as you don't use dependencies tag.

# Development
## Scripts

    $ npm run build
    $ node -r source-map-support/register dist/index.js --cwd /home/user/workspace/project-folder/

![Alt text](/docs/images/development.png "Development output")

## Build binaries
    $ npm run build-linux
    $ npm run build-win
    $ npm run build-macos

# TODO

## Features
- Verbosity on .gitlab-ci.local.yml overrides and appends.

## Unsupported tags, will be implemented in order
- extends
- default
- include:file
- include:template
- include:remote
- artifacts (reset/restore artifacts from job to job via .gitlab-ci.local folder)
- rules
- dependencies (depend or non-depend on artifacts, default is depend ALL)
- when:on_failure,delayed,manual,always,never
- start_in (Used only with when:delayed)
- needs (directed acyclic graph)
- coverage (code coverage)
- retry (in case of failure)
- timeout (job max execution time)

## Docker specfic tags. (Only shell working now)
- services
- image

## Gitlab CI only, will not be used by gitlab-runner-local
- cache
- pages
- resource_group
- interruptible
- environment

## Undecided
- only
- except
- parallel
- trigger
