#!/bin/bash

docker build -t gitlab-ci-local-utils:1 -f Dockerfile.dev $(pwd) 2>&1 | tail -5

docker run --rm -v "$(pwd):/app" \
   -v /var/run/docker.sock:/var/run/docker.sock \
   -w /app -e DOCKER_HOST=unix:///var/run/docker.sock \
   gitlab-ci-local-utils:1 bash \
   -c "npm install --legacy-peer-deps 2>/dev/null && npm run build && npm run test-except-dind" > $(pwd)/test-output.txt 2>&1 &
echo "Tests started. Output going to test-output.txt"