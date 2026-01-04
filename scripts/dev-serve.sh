#!/bin/bash
# Run gitlab-ci-local serve mode without building, using a Node container
# Usage: ./scripts/dev-serve.sh [--build] [PORT]

PORT=3000
BUILD_IMAGE=""

# Parse arguments
for arg in "$@"; do
  if [ "$arg" = "--build" ]; then
    BUILD_IMAGE="1"
  elif [[ "$arg" =~ ^[0-9]+$ ]]; then
    PORT="$arg"
  fi
done

IMAGE_NAME="gcl-dev"

# Build dev image if requested or doesn't exist
if [ -n "$BUILD_IMAGE" ] || ! docker image inspect $IMAGE_NAME >/dev/null 2>&1; then
  echo "Building dev image..."
  docker build -t $IMAGE_NAME -f Dockerfile.dev .
fi

docker run --rm -it \
  --name gcl-dev-serve \
  -v "$(pwd):/app" \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -w /app \
  -p $PORT:$PORT \
  $IMAGE_NAME \
  npx tsx src/index.ts serve --port $PORT --volume /var/run/docker.sock:/var/run/docker.sock
