#!/usr/bin/env bash

# Build script for gitlab-ci-local Linux binary
# This script builds the Linux x64 binary using Docker

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Building gitlab-ci-local Linux binary..."
echo "Project directory: $PROJECT_DIR"

# Run build in Docker container using gcl-dev image
docker run --rm \
  -v "$PROJECT_DIR:/app" \
  -w /app \
  gcl-dev \
  bash -c "
    set -euo pipefail

    # Build TypeScript and generate embedded assets
    echo 'Building...'
    npm run build

    # Build with esbuild
    echo 'Bundling with esbuild...'
    npm run esbuild

    # Package binary
    echo 'Packaging binary...'
    npm run pkg-linux

    echo 'Build complete!'
  "

echo ""
echo "✓ Linux binary built successfully!"
echo "  Binary: bin/linux/gitlab-ci-local"
echo "  Gzipped: bin/linux.gz"
echo ""
echo "To run: ./bin/linux/gitlab-ci-local"
