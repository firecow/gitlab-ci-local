## Introduction

Tired of pushing commits to test your .gitlab-ci.yml?

Then this is the tool for you.

Run gitlab pipelines on your local machine as shell executor or docker executor.

Get rid of all those pesky dev workflow shell scripts and make files.

[![Lines](https://img.shields.io/badge/Coverage-88.94%25-yellow.svg)](https://npmjs.org/package/gitlab-ci-local)
[![build](https://img.shields.io/github/workflow/status/firecow/gitlab-ci-local/build)](https://npmjs.org/package/gitlab-ci-local)
[![vulnerabilities](https://img.shields.io/snyk/vulnerabilities/github/firecow/gitlab-ci-local)](https://npmjs.org/package/gitlab-ci-local)
[![dependencies](https://img.shields.io/librariesio/release/npm/gitlab-ci-local)](https://npmjs.org/package/gitlab-ci-local)
[![npm](https://img.shields.io/npm/v/gitlab-ci-local)](https://npmjs.org/package/gitlab-ci-local)
[![license](https://img.shields.io/github/license/firecow/gitlab-ci-local)](https://npmjs.org/package/gitlab-ci-local)

## Table of contents
* [Introduction](#introduction)
* [Table of contents](#table-of-contents)
* Examples
  * [docker-compose-nodejs](./examples/docker-compose-nodejs/README.md)
* [Installation](#installation)
    * [NPM](#npm)
    * [Linux](#linux)
    * [Windows (Git bash)](#windows-git-bash)
    * [Macos](#macos)
* [Convinience](#convinience)
    * [Bash alias](#bash-alias)
    * [Bash completion](#bash-completion)
* [Quirks](#quirks)
    * [Decorators](#decorators)
    * [Artifacts](#artifacts)
* [Development](#development)
    * [Scripts](#scripts)
    * [Package binaries](#package-binaries)

## Installation
### NPM
```bash
npm install -g gitlab-ci-local
```

### Linux
Download and put binary in `/usr/local/bin`

```bash
sudo su # must be installed as root, if placed in /usr/local/bin/
curl -L https://github.com/firecow/gitlab-ci-local/releases/latest/download/linux.gz | gunzip -c > /usr/local/bin/gitlab-ci-local
chmod +x /usr/local/bin/gitlab-ci-local
exit
```
    
### Windows (Git bash)
Install [gitbash](https://git-scm.com/downloads)

Download and put binary in `C:\Program Files\Git\mingw64\bin`

```bash
curl -L https://github.com/firecow/gitlab-ci-local/releases/latest/download/win.gz | gunzip -c > /c/Program\ Files/Git/mingw64/bin/gitlab-ci-local.exe
```

### Macos
Download and put binary in `/usr/local/bin`

```bash
sudo su # must be installed as root, if placed in /usr/local/bin/
curl -L https://github.com/firecow/gitlab-ci-local/releases/latest/download/macOS.gz | gunzip -c > /usr/local/bin/gitlab-ci-local
chmod +x /usr/local/bin/gitlab-ci-local
exit
```

## Convinience
### Bash alias
```bash
echo "alias gcl='gitlab-ci-local'" >> ~/.bashrc
```

### Bash completion
```bash
gitlab-ci-local --completion >> ~/.bashrc 
```

## Quirks
### Decorators
#### The `@Description` decorator

Adds descriptive text to `gitlab-ci-local --list`
```yml
# @Description Install npm packages
npm-install:
  image: node
  artifacts:
  paths:
    - node_modules/
  script:
    - npm install --no-audit
```
![description-decorator](./docs/images/description-decorator.png)

#### The `@Interactive` decorator
```yml
# @Interactive
interactive-shell:
  rules:
    - if: $GITLAB_CI == 'false'
      when: manual
  script:
    - docker run -it debian bash
```

![description-decorator](./docs/images/interactive-decorator.png)


### Artifacts
Shell executor just place files in host directory

Docker executor copies files specified via artifacts field to host

## Development
### Scripts
```bash
npm install
npm run build
npm start
```

![example](./docs/images/example.png)

### Package binaries
```bash
npm run pkg-linux
npm run pkg-win
npm run pkg-macos
npm run pkg-all
```
