# gitlab-runner-local
Are you tired of pushing to test your .gitlab-ci.yml?

Then this is the tool for you.

### Installation
TODO: Make this.

### Requirements
- bash (linux, macos)
- gitbash (windows)

# Development
### Scripts

    $ npm run build
    $ node -r source-map-support/register dist/index.js --cwd /home/user/workspace/project-folder/

### Build binaries
    $ npm run build-linux
    $ npm run build-win
    $ npm run build-macos

# TODO

### Missing local overrides
None

### Unsupported tags
- include
- after_script
- allow_failure
- rules
- cache
- artifacts/dependencies
- when:on_failure,delayed,manual,always,never
- start_in (Used only with when:delayed)
- needs
- coverage
- retry
- timeout
- parallel
- trigger
- resource_group
- extends
- pages
- environment

### Docker specfic tags.
- services
- image

### Gitlab only sematics, will not be stripped nor used by gitlab-runner-local
- interruptible
- only
- except
