# Building Docker in Docker with a local registry example

#### !!! Important !!!
See how the project is configured in [.gitlab-ci-local-env](.gitlab-ci-local-env)

#### Before you can run if you don't have any local registry.
```bash
docker network create gitlab-ci-local-registry
docker run -d --network gitlab-ci-local-registry --name gitlab-ci-local-registry registry:2
```

#### Start by calling.
```bash
gitlab-ci-local --network gitlab-ci-local-registry --cwd examples/docker-in-docker-build-with-local-registry/
```
