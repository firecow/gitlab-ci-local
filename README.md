# gitlab-runner-local
Are you tired of pushing to test your .gitlab-ci.yml?

Then this is the tool for you.

### Installation
###### Linux
    $ sudo wget -P /usr/bin/ https://github.com/firecow/gitlab-runner-local/raw/master/bin/linux/gitlab-runner-local
    $ sudo chmod +x /usr/bin/gitlab-runner-local
    
###### Windows
TODO: Fill this

###### Macos
TODO: Fill this

### Requirements
- bash (linux, macos)
- gitbash (windows)

### Usage
    $ cd /home/user/workspace/myproject
    $ gitlab-runner-local

### Convinience
###### Bash alias
    $ echo "alias grl='gitlab-runner-local'" >> ~/.bashrc
###### Bash completion
TODO: Fill this

# Development
### Scripts

    $ npm run build
    $ node -r source-map-support/register dist/index.js --cwd /home/user/workspace/project-folder/

### Build binaries
    $ npm run build-linux
    $ npm run build-win
    $ npm run build-macos

# TODO

###### Features
- Verbosity on .gitlab-ci.local.yml overrides and appends.

###### Missing local overrides
None

###### Unsupported tags
- include
- extends
- after_script
- default
- allow_failure
- rules
- cache
- artifacts/dependencies (.gitignore )
- when:on_failure,delayed,manual,always,never
- start_in (Used only with when:delayed)
- needs (directed acyclic graph)
- coverage (code coverage)
- retry (in case of failure)
- timeout (job max execution time)


###### Docker specfic tags. (Only shell working now)
- services
- image

###### Gitlab CI only, will not be used by gitlab-runner-local
- pages
- resource_group
- interruptible
- only
- except
- environment

###### Undecided
- parallel
- trigger
