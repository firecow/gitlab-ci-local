#!/bin/bash
# Test script for the web UI serve command
# Starts the server and runs basic API tests

set -e

PORT=${1:-3000}
NODE_VERSION=${2:-24}

# Kill any existing instances
pkill -f "gitlab-ci-local serve" 2>/dev/null || true
docker stop gcl-test-serve 2>/dev/null || true
sleep 1

echo "Starting serve on port $PORT..."

echo "Using binary: ./bin/linux/gitlab-ci-local serve --port $PORT"
./bin/linux/gitlab-ci-local serve --port $PORT &
PID=$!
sleep 4

echo ""
echo "=== Testing Frontend ==="
curl -s http://localhost:$PORT/ | head -c 500
echo ""
echo ""

echo "=== Testing Pipelines API ==="
curl -s http://localhost:$PORT/api/pipelines | head -c 200
echo ""
echo ""

echo "=== Testing YAML API ==="
curl -s http://localhost:$PORT/api/config/yaml | head -c 300
echo ""
echo ""

echo "=== Testing Config API ==="
curl -s http://localhost:$PORT/api/config
echo ""
echo ""

echo "Server running at http://localhost:$PORT"
echo "Press Ctrl+C to stop..."

# Wait for the server process or container
if [ -n "$PID" ]; then
    wait $PID
else
    docker logs -f gcl-test-serve
fi
