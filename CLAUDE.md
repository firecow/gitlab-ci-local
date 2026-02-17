# Project: gitlab-ci-local

CLI tool to run GitLab CI pipelines locally. Written in TypeScript, built with Bun.

## Build & Runtime

- **Runtime**: Bun (not Node.js). All scripts use `bun`/`bun test`/`bun run`.
- **npm publish**: Still uses `npm publish --provenance` because Bun doesn't support provenance.
- **`bin` field**: Points to `dist/index.js` (Node.js-compatible bundle built by `bun run build:node`), not `src/index.ts`. This keeps `npm install -g` working without Bun.
- **Standalone binaries**: Built with `bun build --compile` for linux-amd64, linux-arm64, macos-x64, macos-arm64, win.
- **Version**: Hardcoded as `0.0.0` in `package.json`. CI replaces it via `sed` before build/publish. At runtime, `src/index.ts` reads it from `package.json` import.

## Testing

- **Never run the full test suite** (`bun test`), it takes too long. Always run targeted tests: `bun test --timeout 60000 tests/test-cases/<name>/`
- **Timeout**: `bunfig.toml` timeout setting does not work. The `--timeout 60000` flag in package.json scripts is required.
- **Docker tests**: Tests under `dind-*` require Docker and are slow.
- **depcheck ignores**: `depcheck,@types/bun,@types/bun-types,bun:test`

## Schema

- `src/schema.json` is fetched from upstream GitLab via `bun run fetch-schema`.
- `src/schema.ts` patches the schema: adds `gcl*` properties and strips patterns that are too strict for gitlab-ci-local (e.g., include glob wildcards, cache keys with `/`).
- Don't strip all patterns — most are valid. Only strip specific ones that conflict with gitlab-ci-local features.

## Release artifacts

- GitHub releases: `gitlab-ci-local-{os}-{arch}.tar.gz` (linux/darwin) and `.zip` (windows), plus `.asc` signatures
- Debian PPA: amd64 and arm64 `.deb` packages, hosted on Cloudflare R2
- npm: `dist/index.js` bundle targeting Node.js
