# docker swarm php example

- Install composer packages
    - Expose vendor folder via artifacts (composer-install)
- Build PHP image, via complex shell scripting and docker build commands using gitlab predefined variables (build-php)
- Analyse PHP code for mistakes (php-cs-fixer-dry-run)
    - Will warn locally, and fail remotely
- Check for outdated packages (composer-outdated)
    - Will only warn
- Deploy swarm services via docker stack deploy (deploy)

Start by calling.
```bash
gitlab-ci-local --cwd examples/docker-swarm-php/
```

If you want stop the stack services call. This is a local only job.
```bash
gitlab-ci-local --cwd examples/docker-swarm-php/ remove-stack
```
