# docker-compose nodejs example

- Install npm packages
  - Copy those packages to host and child jobs, because of the artifacts fields (npm-install) 
- Check for security vulnerbilities in npm packages (npm-audit)
- Check for outdated packages via npm-check-updates package (npm-outdated)
- Deploy a webserver container via docker-compose (docker-compose-up)


```
gitlab-ci-local --cwd examples/docker-compose-nodejs/
```
