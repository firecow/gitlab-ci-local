#!/bin/bash
# Usage: ./scripts/rebuild.sh
docker run --rm -v $(pwd):/app -w /app node:24 bash \
  -c 'npm run build 2>&1'