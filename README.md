## Introduction

[![coverage](coverage/badge.svg)](https://npmjs.org/package/gitlab-ci-local)
[![build](https://github.com/firecow/gitlab-ci-local/workflows/build/badge.svg)](https://npmjs.org/package/gitlab-ci-local)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://npmjs.org/package/gitlab-ci-local)
[![npm](https://img.shields.io/npm/v/gitlab-ci-local?color=green)](https://npmjs.org/package/gitlab-ci-local)

Are you tired of pushing commits to test your .gitlab-ci.yml?

Then this is the tool for you.

Run gitlab pipelines on your local machine as shell runner or docker executor.

Get rid of all those "pesky" dev workflow shell scripts and make files. 

## Table of contents
* [Introduction](#introduction)
* [Table of contents](#table-of-contents)
* [Installation](#installation)
    * [NPM](#npm)
    * [Linux](#linux)
    * [Windows (Git bash)](#windows-git-bash)
    * [Macos](#macos)
* [Usage](#usage)
    * [Examples](#examples)
    * [Convinience](#convinience)
        * [Bash alias](#bash-alias)
        * [Bash completion](#bash-completion)
    * [Quirks](#quirks)
        * [Artifacts](#artifacts)
* [Development](#development)
    * [Scripts](#scripts)
    * [Package binaries](#package-binaries)
    * [Will not be implemented](#will-not-be-implemented)

## Installation
### NPM
```
npm install -g gitlab-ci-local
```

### Linux
Download and put binary in `/usr/local/bin`

```
sudo su # must be installed as root, if placed in /usr/local/bin/
curl -L https://github.com/firecow/gitlab-ci-local/releases/latest/download/linux.gz | gunzip -c > /usr/local/bin/gitlab-ci-local
chmod +x /usr/local/bin/gitlab-ci-local
exit
```
    
### Windows (Git bash)
Install [gitbash](https://git-scm.com/downloads)

Download and put binary in `C:\Program Files\Git\mingw64\bin`

```
curl -L https://github.com/firecow/gitlab-ci-local/releases/latest/download/win.gz | gunzip -c > /c/Program\ Files/Git/mingw64/bin/gitlab-ci-local.exe
```

### Macos
Download and put binary in `/usr/local/bin`

```
sudo su # must be installed as root, if placed in /usr/local/bin/
curl -L https://github.com/firecow/gitlab-ci-local/releases/latest/download/macOS.gz | gunzip -c > /usr/local/bin/gitlab-ci-local
chmod +x /usr/local/bin/gitlab-ci-local
exit
```

## Usage
### Examples

- Docker Compose "deploy" a nodejs webserver


### Convinience
#### Bash alias
```
echo "alias gcl='gitlab-ci-local'" >> ~/.bashrc
```

#### Bash completion

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

### Quirks
#### Artifacts
Artifacts works right now, as along as you don't overwrite tracked files.

## Development
### Scripts
```
npm install
npm run build
npm start -- --cwd /home/user/workspace/project-folder/
```

![output](docs/images/development.png)

### Package binaries
```
npm run pkg-linux
npm run pkg-win
npm run pkg-macos
npm run pkg-all
```

### Will not be implemented
- cache
- pages
- resource_group
- interruptible
- only
- except
- parallel
- trigger
- retry (in case of failure)
- timeout (job max execution time)
- coverage (code coverage)
