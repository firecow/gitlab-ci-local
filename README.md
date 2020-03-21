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
      * [Unsupported tags, will be implemented in order](#unsupported-tags-will-be-implemented-in-order)
      * [Docker specfic tags. (Only shell working now)](#docker-specfic-tags-only-shell-working-now)
      * [Will not be implemented](#will-not-be-implemented)
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

Add this to `~/.bashrc`
```
_yargs_completions()
{
    local cur_word args type_list

    cur_word="${COMP_WORDS[COMP_CWORD]}"
    args=("${COMP_WORDS[@]}")

    # ask yargs to generate completions.
    type_list=$(/usr/local/bin/gitlab-ci-local --get-yargs-completions "${args[@]}")

    COMPREPLY=( $(compgen -W "${type_list}" -- ${cur_word}) )

    # if no match was found, fall back to filename completion
    if [ ${#COMPREPLY[@]} -eq 0 ]; then
      COMPREPLY=()
    fi

    return 0
}
complete -o default -F _yargs_completions gitlab-ci-local
```

## Quirks
### Artifacts
Artifacts works right now, as along as you don't overwrite tracked files and as long as you don't use dependencies tag.

# Development
## Scripts

    $ npm install
    $ npm run build
    $ node -r source-map-support/register dist/index.js --cwd /home/user/workspace/project-folder/

![Alt text](/docs/images/development.png "Development output")

## Build binaries
    $ npm run build-linux
    $ npm run build-win
    $ npm run build-macos
    $ npm run build-all

# TODO

## Unsupported tags, will be implemented in order
- rules
- environment
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

## Will not be implemented
- cache
- pages
- resource_group
- interruptible

## Undecided
- artifacts (reset/restore/uploads "files" from job to job)
- dependencies (depend or non-depend on artifacts, default is depend ALL)
- only
- except
- parallel
- trigger
