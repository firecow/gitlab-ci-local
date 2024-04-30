# Building Docker in Docker with a local registry example

#### !!! Important !!!
See how the project is configured in [.gitlab-ci-local-env](.gitlab-ci-local-env)

#### Before you can run if you don't have any local registry.
```bash
docker network create gitlab-ci-local-registry --subnet=10.11.22.0/24
docker run -d -p 5000:5000 --network gitlab-ci-local-registry --ip=10.11.22.33 --name gitlab-ci-local-registry registry
```

#### Start by calling.
```bash
gitlab-ci-local --cwd examples/docker-in-docker-build-with-local-registry/
```
