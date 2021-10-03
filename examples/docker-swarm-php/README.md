# docker swarm php example

- Install composer packages (composer-install)
    - Expose vendor folder via artifacts 
    - Cache composer home folder (for speed)
- Build PHP image (build-php)
  - Use gitlab predefined variables to name image properly
  - Prevent accidental docker push locally 
- Analyse PHP code for mistakes (php-cs-fixer-dry-run)
    - Will warn locally, and fail remotely
- Check for outdated packages (composer-outdated)
    - Will only warn
- Deploy swarm services via docker stack deploy (deploy)
    - Use artifacts.reports.dotenv from build-php job

Start by calling.
```bash
gitlab-ci-local --cwd examples/docker-swarm-php/
```

If you want stop the stack services call. This is a local only job.
```bash
gitlab-ci-local --cwd examples/docker-swarm-php/ remove-stack
```
