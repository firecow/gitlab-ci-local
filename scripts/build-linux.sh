#!/usr/bin/env bash

# Build script for gitlab-ci-local Linux binary
# This script builds the Linux x64 binary using Docker

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_VERSION="24"

echo "Building gitlab-ci-local Linux binary..."
echo "Working directory: $SCRIPT_DIR"

# Run build in Docker container
docker run --rm \
  -v "$SCRIPT_DIR:/app" \
  -w /app \
  "node:$NODE_VERSION" \
  bash -c "
    set -euo pipefail

    # Configure git safe directory
    git config --global --add safe.directory /app

    # Install dependencies if not already installed
    echo 'Installing dependencies...'
    npm install

    # Clean old builds
    echo 'Cleaning old builds...'
    git clean -fX src/ tests/

    # Build TypeScript
    echo 'Building TypeScript...'
    ./node_modules/.bin/tsc

    # Build with esbuild
    echo 'Bundling with esbuild...'
    ./node_modules/.bin/esbuild src/index.ts --outfile=bin/index.cjs --bundle --platform=node --format=cjs --minify --external:yargs --sourcemap=inline

    # Package binary with frontend assets
    echo 'Packaging binary...'
    npx -y @yao-pkg/pkg bin/index.cjs --public --options=enable-source-maps --no-bytecode -t linux-x64 -o bin/linux/gitlab-ci-local \
      --assets 'src/web/frontend/index.html' \
      --assets 'src/web/frontend/app.js' \
      --assets 'src/web/frontend/styles/main.css' \
      --assets 'src/web/frontend/components/*.js' \
      --assets 'src/web/frontend/utils/*.js' \
      --assets 'src/schema/schema.json'
    chmod +x bin/linux/gitlab-ci-local
    gzip -f -c bin/linux/gitlab-ci-local > bin/linux.gz

    echo 'Build complete!'
  "

echo ""
echo "✓ Linux binary built successfully!"
echo "  Binary: bin/linux/gitlab-ci-local"
echo "  Gzipped: bin/linux.gz"
echo ""
echo "To run: ./bin/linux/gitlab-ci-local"
