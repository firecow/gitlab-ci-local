# docker compose nodejs example

- Install npm packages
    - Copy those packages to host and child jobs, because of the artifacts fields (npm-install)
- Check for security vulnerbilities in npm packages (npm-audit)
- Check for outdated packages via npm-check-updates package (npm-outdated)
- Deploy a webserver container via docker compose (docker-compose-up)

```bash
gitlab-ci-local --cwd examples/docker-compose-nodejs/
```

If you want to down docker compose service call.

This job is only run locally, and only when manually triggered

```bash
gitlab-ci-local --cwd examples/docker-compose-nodejs/ docker-compose-down
```
