# Project: gitlab-ci-local

CLI tool to run GitLab CI pipelines locally. Written in TypeScript, built with Bun.

## Build & Runtime

- **Runtime**: Bun (not Node.js). All scripts use `bun`/`bun run`. Tests use vitest.
- **npm publish**: Still uses `npm publish --provenance` because Bun doesn't support provenance.
- **`bin` field**: Points to `dist/index.js` (Node.js-compatible bundle built by `bun run build:node`), not `src/index.ts`. This keeps `npm install -g` working without Bun.
- **Standalone binaries**: Built with `bun build --compile` for linux-amd64, linux-arm64, macos-x64, macos-arm64, win.
- **Version**: Hardcoded as `0.0.0` in `package.json`. CI replaces it via `sed` before build/publish. At runtime, `src/index.ts` reads it from `package.json` import.
- **Two runtimes**: The same source runs on Node (npm bundle, `engines.node >=24.14.0`) and Bun (binaries). CI smoke-tests Node 24/25 against Bun 1.2.23/1.3.10. Only use a built-in when it behaves identically on both.
- **Proxy**: Remote includes use `fetch`. Bun reads `HTTP(S)_PROXY`/`NO_PROXY` natively; Node needs the `http.setGlobalProxyFromEnv?.()` call in `src/index.ts` (absent on Bun, added in Node 24.14.0).

## Dependencies

- Prefer a Node/Bun built-in or 10-20 inline lines over a small package to shrink supply-chain surface.
- Built-ins that diverge and must not replace their package:
  - `util.parseEnv` (Node truncates `"esc \"q\""`) → keep `dotenv`.
  - `fs.globSync` has no `dot` option, and Node and Bun disagree on directories → keep `globby`.
  - `path.matchesGlob` takes no options, and Node and Bun disagree on dotfiles → keep `micromatch`.
  - `readline` splits on lone `\r`, which breaks `section_start:…\r\e[0K` → use the inline splitter in `Job.execScripts`.
- Kept deliberately:
  - `camelcase` shapes `CI_PROJECT_TITLE`.
  - `terminal-link` is mostly terminal detection.
  - `js-yaml` handles the `!reference` custom tag.
  - `re2js` gives GitLab's RE2 semantics.
  - `execa`, `yargs`, `ajv`, `semver` and `chalk-template` are used too widely to replace.

## Testing

- **Never run the full test suite** (`bun run test`), it takes too long. Always run targeted tests: `bunx vitest run tests/test-cases/<name>/`
- **Timeout**: Configured in `vitest.config.ts` (`testTimeout: 60_000`).
- **Docker tests**: Tests under `dind-*` require Docker and are slow.
- **Stale state dirs**: Test runs leave gitignored `.gitlab-ci-local-*` dirs inside `tests/test-cases/<name>/`. Cached includes and caches there can make a broken test pass. Run `git clean -fdX tests/test-cases/<name>` before trusting a result. Local `depcheck` also scans them.
- **Stay on vitest**: The suite needs per-file worker isolation for `process.chdir` (`argv-cwd`), `process.env` mutation and module spies. `bun test` runs every file in one process.
- **HTTP mocks**: `vi.spyOn(globalThis, "fetch")` keyed by exact URL, returning 404 for anything else.
- **Hash assertions**: `cache-key-files` and `cache-key-prefix` assert SHA-256 cache-key hashes. Update them when `Utils.checksumFiles` changes.
- **depcheck ignores**: `depcheck,@types/bun,@types/bun-types,vitest,@vitest/coverage-v8`

## CI

- SonarCloud's quality gate fails on weak hashes (SHA-1/MD5) in new code; use SHA-256.
- SonarCloud flags `await` inside loops in new code; prefer recursion with early returns or `Promise.all`.
- Pull-request workflows don't start while the PR has merge conflicts. Renovate merges often, so rebase first.

## Schema

- `src/schema.json` is fetched from upstream GitLab via `bun run fetch-schema`.
- `src/schema.ts` patches the schema: adds `gcl*` properties and strips patterns that are too strict for gitlab-ci-local (e.g., include glob wildcards, cache keys with `/`).
- Don't strip all patterns — most are valid. Only strip specific ones that conflict with gitlab-ci-local features.

## Release artifacts

- GitHub releases: `gitlab-ci-local-{os}-{arch}.tar.gz` (linux/darwin) and `.zip` (windows), plus `.asc` signatures
- Debian PPA: amd64 and arm64 `.deb` packages, hosted on Cloudflare R2
- npm: `dist/index.js` bundle targeting Node.js
