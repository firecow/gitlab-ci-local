Tired of pushing to test your .gitlab-ci.yml?

Run gitlab pipelines locally as shell executor or docker executor.

Get rid of all those dev specific shell scripts and make files.

[![build](https://img.shields.io/github/actions/workflow/status/firecow/gitlab-ci-local/build.yml?branch=master)](https://github.com/firecow/gitlab-ci-local/actions)
[![Known Vulnerabilities](https://snyk.io/test/github/firecow/gitlab-ci-local/badge.svg)](https://snyk.io/test/github/firecow/gitlab-ci-local)
[![npm](https://img.shields.io/npm/v/gitlab-ci-local)](https://npmjs.org/package/gitlab-ci-local)
[![license](https://img.shields.io/github/license/firecow/gitlab-ci-local)](https://npmjs.org/package/gitlab-ci-local)
[![Renovate](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com)

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=firecow_gitlab-ci-local&metric=alert_status)](https://sonarcloud.io/dashboard?id=firecow_gitlab-ci-local)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=firecow_gitlab-ci-local&metric=sqale_rating)](https://sonarcloud.io/dashboard?id=firecow_gitlab-ci-local)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=firecow_gitlab-ci-local&metric=reliability_rating)](https://sonarcloud.io/dashboard?id=firecow_gitlab-ci-local)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=firecow_gitlab-ci-local&metric=security_rating)](https://sonarcloud.io/dashboard?id=firecow_gitlab-ci-local)

[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=firecow_gitlab-ci-local&metric=coverage)](https://sonarcloud.io/dashboard?id=firecow_gitlab-ci-local)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=firecow_gitlab-ci-local&metric=code_smells)](https://sonarcloud.io/dashboard?id=firecow_gitlab-ci-local)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=firecow_gitlab-ci-local&metric=duplicated_lines_density)](https://sonarcloud.io/dashboard?id=firecow_gitlab-ci-local)

## Table of contents

* [Examples](./examples)
    * [docker-compose-nodejs](./examples/docker-compose-nodejs)
    * [docker-swarm-php](./examples/docker-swarm-php)
    * [docker-in-docker-build](./examples/docker-in-docker-build)
    * [docker-in-docker with a local registry](./examples/docker-in-docker-build-with-local-registry)
    * [scheduled-pipeline-testing](./examples/scheduled-pipeline-testing)
* [Installation](#installation)
* [Convenience](#convenience)
    * [CLI options](#cli-options)
      * [Via a file](#via-a-file)
      * [Via environment variables](#via-environment-variables)
    * [DotEnv file](#dotenv-file)
    * [Bash alias](#bash-alias)
    * [Tab completion](#tab-completion)
    * [Listing jobs](#list-pipeline-jobs)
* [Quirks](#quirks)
    * [Tracked Files](#tracked-files)
    * [Local Only](#local-only)
    * [Home File Variables](#home-file-variables)
    * [Remote File Variables](#remote-file-variables)
    * [Project File Variables](#project-file-variables)
    * [Decorators](#decorators)
    * [Includes](#includes)
    * [Artifacts](#artifacts)
    * [Self Hosted Custom Ports](#self-hosted-custom-ports)
* [Development](#development)
    * [Scripts](#scripts)
* [Creating single executable binaries from source](#creating-single-executable-binaries-from-source)

## Installation

### Linux based on Debian

Users of Debian-based distributions should prefer the [the Deb822 format][deb822], installed with:

```bash
sudo wget -O /etc/apt/sources.list.d/gitlab-ci-local.sources https://gitlab-ci-local-ppa.firecow.dk/gitlab-ci-local.sources
sudo apt-get update
sudo apt-get install gitlab-ci-local
```

  [deb822]: https://repolib.readthedocs.io/en/latest/deb822-format.html#deb822-format

If your distribution does not support this, you can run these commands:

```bash
curl -s "https://gitlab-ci-local-ppa.firecow.dk/pubkey.gpg" | sudo apt-key add -
echo "deb https://gitlab-ci-local-ppa.firecow.dk ./" | sudo tee /etc/apt/sources.list.d/gitlab-ci-local.list

# OR

# MUST be `.asc` at least for older apts (e.g. Ubuntu Focal), since the key is ASCII-armored
PPA_KEY_PATH=/etc/apt/sources.list.d/gitlab-ci-local-ppa.asc
curl -s "https://gitlab-ci-local-ppa.firecow.dk/pubkey.gpg" | sudo tee "${PPA_KEY_PATH}"
echo "deb [ signed-by=${PPA_KEY_PATH} ] https://gitlab-ci-local-ppa.firecow.dk ./" | sudo tee /etc/apt/sources.list.d/gitlab-ci-local.list

# and then

sudo apt-get update
sudo apt-get install gitlab-ci-local
```

Note that the path `/etc/apt/sources.list.d/gitlab-ci-local.list` is used in the file `gitlab-ci-local.list`.
If you change it in these commands you must also change it in `/etc/apt/sources.list.d/gitlab-ci-local.list`.

### NPM

```bash
npm install -g gitlab-ci-local
```

### Macos

*bash version must be above or equal 4.x.x*

```bash
brew install gitlab-ci-local
```

### Windows (Git bash)

- Install [gitbash](https://git-scm.com/downloads)
- Install [rsync](https://gist.github.com/radleta/0b337a2b14f761951cf2aab0578512b9)

Download and put binary in `C:\Program Files\Git\mingw64\bin`

```bash
curl -L https://github.com/firecow/gitlab-ci-local/releases/latest/download/win.gz | gunzip -c > /c/Program\ Files/Git/mingw64/bin/gitlab-ci-local.exe
```

Executing `gitlab-ci-local` with `--variable MSYS_NO_PATHCONV=1` can be useful in certain situations

## Convenience

### CLI options
> [!NOTE]
> Most likely [home-file-variables](https://github.com/firecow/gitlab-ci-local?tab=readme-ov-file#home-file-variables) or [project-file-variables](https://github.com/firecow/gitlab-ci-local?tab=readme-ov-file#project-file-variables) is what you're looking for instead

All cli options can be assigned default values by either of the following ways:

#### Via environment variables
```bash
export GCL_NEEDS=true                   # --needs options
export GCL_FILE='.gitlab-ci-local.yml'  # --file=.gitlab-ci-local.yml
```

#### Via a file
```sh
# Either of the following:
# - `.gitlab-ci-local-env` in the current working directory
# - `$HOME/.gitlab-ci-local/.env`
NEEDS=true               # --needs
FILE=doctor-strange.yml  # --file=doctor-strange.yml
```

### Bash alias

```bash
echo "alias gcl='gitlab-ci-local'" >> ~/.bashrc
```

### Tab completion

```bash
gitlab-ci-local --completion >> ~/.bashrc
```

### Logging options

```shell
export GCL_TIMESTAMPS=true # or --timestamps: show timestamps in logs
export GCL_MAX_JOB_NAME_PADDING=30 # or --maxJobNamePadding: limit padding around job name
export GCL_QUIET=true # or --quiet: Suppress all job output
```


### Pipeline Simulation Options

#### --pipeline-source
Simulate different pipeline sources for testing complex GitLab CI configurations locally.

**Supported values:**
- `push` (default) - Standard development pipeline
- `schedule` - Scheduled pipeline
- `merge_request_event` - Merge request pipeline  
- `web` - Web-triggered pipeline
- `api` - API-triggered pipeline
- `external` - External pipeline
- `chat` - Chat-triggered pipeline
- `external_pull_request_event` - External pull request on GitHub
- `ondemand_dast_scan` - DAST on-demand scan pipelines
- `ondemand_dast_validation` - DAST on-demand validation pipelines
- `parent_pipeline` - Parent/child pipeline triggers
- `pipeline` - Multi-project pipelines
- `security_orchestration_policy` - Scheduled scan execution policies
- `trigger` - Downstream pipeline triggers
- `webide` - Web IDE pipelines

**Examples:**
```bash
# Test scheduled pipeline behavior
gitlab-ci-local --pipeline-source schedule --list

# Test merge request pipeline
gitlab-ci-local --pipeline-source merge_request_event --list

# Test downstream pipeline
gitlab-ci-local --pipeline-source trigger --list

# Test multi-project pipeline
gitlab-ci-local --pipeline-source pipeline --list

# Test external pull request
gitlab-ci-local --pipeline-source external_pull_request_event --list

# Test DAST scan
gitlab-ci-local --pipeline-source ondemand_dast_scan --list

# Test parent pipeline
gitlab-ci-local --pipeline-source parent_pipeline --list

# Test Web IDE
gitlab-ci-local --pipeline-source webide --list
```

**Validation:**
The tool validates pipeline source values and provides clear error messages for invalid options. All values are restricted to the official GitLab CI pipeline sources.

#### --schedule-name
Specify the exact schedule name for testing scheduled pipelines. This is particularly useful for testing complex conditional logic in scheduled pipelines.

**Examples:**
```bash
# Test specific npm dependency update schedule
gitlab-ci-local --pipeline-source schedule --schedule-name "npm Dependency Update" --list

# Test OpenBSD snapshot schedule
gitlab-ci-local --pipeline-source schedule --schedule-name "Daily OpenBSD Snapshot Check" --list
```

**Validation:**
Schedule names are validated for:
- Non-empty values
- Maximum length of 255 characters
- Invalid filesystem characters (`< > : " \ | ? *`)
- Clear error messages for validation failures
### List Pipeline Jobs

Sometimes there is the need of knowing which jobs will be added before actually executing the pipeline.
GitLab CI Local is providing the ability of showing added jobs with the following cli flags.

#### --list

The command `gitlab-ci-local --list` will return pretty output and will also filter all jobs which are set
to `when: never`.

```text
name        description  stage   when        allow_failure  needs
test-job    Run Tests    test    on_success  false
build-job                build   on_success  true           [test-job]
```

#### --list-all

Same as `--list` but will also print out jobs which are set to `when: never` (directly and implicit e.g. via rules).

```text
name        description  stage   when        allow_failure  needs
test-job    Run Tests    test    on_success  false
build-job                build   on_success  true           [test-job]
deploy-job               deploy  never       false          [build-job]
```

#### --list-csv

The command `gitlab-ci-local --list-csv` will output the pipeline jobs as csv formatted list and will also filter all
jobs which are set
to `when: never`.
The description will always be wrapped in quotes (even if there is none) to prevent semicolons in the description
disturb the csv structure.

```text
name;description;stage;when;allow_failure;needs
test-job;"Run Tests";test;on_success;false;[]
build-job;"";build;on_success;true;[test-job]
```

#### --list-csv-all

Same as `--list-csv-all` but will also print out jobs which are set to `when: never` (directly and implicit e.g. via
rules).

```text
name;description;stage;when;allow_failure;needs
test-job;"Run Tests";test;on_success;false;[]
build-job;"";build;on_success;true;[test-job]
deploy-job;"";deploy;never;false;[build-job]
```


## Testing Complex Pipeline Scenarios

### Enhanced Error Handling & Validation

GitLab CI Local now includes comprehensive validation for pipeline simulation options:

- **Pipeline Source Validation**: Restricts values to official GitLab CI pipeline sources (15 supported types)
- **Schedule Name Validation**: Ensures schedule names meet filesystem and length requirements
- **Clear Error Messages**: Provides actionable feedback for invalid inputs
- **Environment Variable Support**: Automatically detects and validates `CI_PIPELINE_SOURCE` and `SCHEDULE_NAME` from environment
- **Constants-Based Validation**: Uses centralized constants for maintainable validation logic

**Error Handling Examples:**
```bash
# Invalid pipeline source
gitlab-ci-local --pipeline-source invalid_source --list
# Error: Invalid pipeline source: "invalid_source". Valid options are: push, schedule, merge_request_event, web, api, external, chat, external_pull_request_event, ondemand_dast_scan, ondemand_dast_validation, parent_pipeline, pipeline, security_orchestration_policy, trigger, webide

# Invalid schedule name
gitlab-ci-local --pipeline-source schedule --schedule-name "invalid<name" --list
# Error: Schedule name contains invalid characters: <. Please use only valid characters.
```

GitLab CI Local now supports testing complex pipeline configurations including:

- **Scheduled Pipelines**: Test pipelines triggered by GitLab schedules
- **Conditional Includes**: Test complex `rules` and conditional logic
- **Pipeline Source Simulation**: Test different pipeline trigger types
- **Environment Variable Handling**: Test CI_* and SCHEDULE_NAME variables

### Example: Testing Scheduled Pipeline with Conditional Logic

```bash
# Test a scheduled pipeline that has complex conditional includes
gitlab-ci-local --pipeline-source schedule --schedule-name "Daily Check" --list

# Compare with standard development pipeline
gitlab-ci-local --pipeline-source push --list
```

### Example: Testing Complex Rules

```bash
# Test specific schedule names
gitlab-ci-local --pipeline-source schedule --schedule-name "npm Dependency Update" --list
gitlab-ci-local --pipeline-source schedule --schedule-name "Daily OpenBSD Snapshot Check" --list
```

See the [scheduled-pipeline-testing](./examples/scheduled-pipeline-testing) example for comprehensive usage patterns.
## Quirks

### Tracked Files

Untracked and ignored files will not be synced inside isolated jobs, only tracked files are synced.

Remember `git add`

### Local Only

```yml
local-only-job:
  rules:
    - { if: $GITLAB_CI == 'false' }
```

```yml
local-only-subsection:
  script:
    - if [ $GITLAB_CI == 'false' ]; then eslint . --fix; fi
    - eslint .
```

### Home file variables

Put a file like this in `$HOME/.gitlab-ci-local/variables.yml`

```yaml
---
project:
  gitlab.com/test-group/test-project.git:
    # Will be type Variable and only available if remote is exact match
    AUTHORIZATION_PASSWORD: djwqiod910321
  gitlab.com:project/test-group/test-project.git: # another syntax
    AUTHORIZATION_PASSWORD: djwqiod910321

group:
  gitlab.com/test-group/:
    # Will be type Variable and only available for remotes that include group named 'test-group'
    DOCKER_LOGIN_PASSWORD: dij3213n123n12in3

global:
  # Will be type File, because value is a file path
  KNOWN_HOSTS: '~/.ssh/known_hosts'
  DEPLOY_ENV_SPECIFIC:
    type: variable # Optional and defaults to variable
    values:
      '*production*': 'Im production only value'
      'staging': 'Im staging only value'
  FILE_CONTENT_IN_VALUES:
    type: file
    values:
      '*': |
        Im staging only value
        I'm great for certs n' stuff
```

Variables will now appear in your jobs, if project or group matches git remote, globals are always present

### Remote file variables

```shell
gitlab-ci-local --remote-variables git@gitlab.com:firecow/example.git=gitlab-variables.yml=master
```

### Project file variables

The `--variables-file` [default: $CWD/.gitlab-ci-local-variables.yml] can be used to setup the CI/CD variables for the executors

#### `yaml` format
```yaml
---
AUTHORIZATION_PASSWORD: djwqiod910321
DOCKER_LOGIN_PASSWORD: dij3213n123n12in3
# Will be type File, because value is a file path
KNOWN_HOSTS: '~/.ssh/known_hosts'

# This is only supported in the yaml format
# https://docs.gitlab.com/ee/ci/environments/index.html#limit-the-environment-scope-of-a-cicd-variable
EXAMPLE:
  values:
    "*": "I am only available in all jobs"
    staging: "I am only available in jobs with `environment: staging`"
    production: "I am only available in jobs with `environment: production`"
```

#### `.env` format
```
AUTHORIZATION_PASSWORD=djwqiod910321
DOCKER_LOGIN_PASSWORD=dij3213n123n12in3
# NOTE: value will be '~/.ssh/known_hosts' which is different behavior from the yaml format
KNOWN_HOSTS='~/.ssh/known_hosts'
```

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

#### The `@InjectSSHAgent` decorator

```yml
# @InjectSSHAgent
need-ssh:
  image: kroniak/ssh-client
  script:
    - ssh-add -L
```

#### The `@NoArtifactsToSource` decorator

Prevent artifacts from being copied to source folder

```yml
# @NoArtifactsToSource
produce:
  stage: build
  script: mkdir -p path/ && touch path/file1
  artifacts: { paths: [ path/ ] }
```

A global configuration is possible when setting the following flag

```shell
gitlab-ci-local --no-artifacts-to-source
```

### Includes

Includes from external sources are only fetched once and cached. Use `--fetch-includes` to ensure that the latest external sources are always fetched.

### Artifacts

Shell executor jobs copies artifacts to host/cwd directory. Use --shell-isolation option to mimic correct artifact
handling for shell jobs.

Docker executor copies artifacts to and from .gitlab-ci-local/artifacts

### Self Hosted Custom Ports

If your self-hosted GitLab instance uses custom ports, it is recommended to manually define the `CI_SERVER_PORT` and/or `CI_SERVER_SHELL_SSH_PORT` variables accordingly.

```yaml
---
# $CWD/.gitlab-ci-local-variables.yml

CI_SERVER_PORT: 8443
CI_SERVER_SHELL_SSH_PORT: 8022
```

### Special variables
- `GCL_PROJECT_DIR_ON_HOST` Absolute path to gitlab-ci-local current working directory on the host machine. Use in docker-executor jobs only.

## Development

You need nodejs 18+

### Scripts

```bash
# Install node_modules
npm install

# Run all tests
npm run test

# Run the program with hot-reloading enabled using the `.gitlab-ci.yml` in the root directory
npm run dev

# Pass --help flag into the program
npm run dev -- -- --help # (equivalent of gitlab-ci-local --help)

# Run individual test-case
npx jest tests/test-cases/cache-paths-not-array
```

![example](./docs/images/example.png)

It's also possible to run individual `.gitlab-ci.yml`, via `npx tsx src/index.ts --cwd examples/docker-compose-nodejs`

## Creating single executable binaries from source
```bash
npm install
npm run esbuild

# According to your needs:
npm run pkg-linux
npm run pkg-win
npm run pkg-macos
npm run pkg-all
# the binary will be generated in the respective ./bin/<os>/gitlab-ci-local
```
