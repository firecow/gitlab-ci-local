# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

gitlab-ci-local is a CLI tool that runs GitLab CI pipelines locally without pushing to GitLab. It supports both shell and docker executors, allowing developers to test their `.gitlab-ci.yml` configurations locally.

## Development Commands

### Basic Development
```bash
npm install              # Install dependencies
npm run build           # Compile TypeScript (includes cleanup)
npm run dev             # Run with hot-reloading using .gitlab-ci.yml in root
npm run lint            # Run eslint
npm run test            # Run all tests (60s timeout)
npm run coverage        # Run tests with coverage report
npm run check-all       # Run build, lint, coverage, and audit
```

### Running Specific Tests
```bash
# Run a single test case
npx jest tests/test-cases/artifacts-docker

# Run tests excluding docker-in-docker tests (faster)
npm run test-except-dind
```

### Running the CLI Locally
```bash
# Run against example project
npm run start

# Run with custom arguments (note the double --)
npm run dev -- -- --help

# Run against specific directory
npx tsx src/index.ts --cwd examples/docker-compose-nodejs
```

### Building Executables
```bash
npm run esbuild         # Bundle the project
npm run pkg-linux       # Build Linux executable
npm run pkg-macos       # Build macOS executable
npm run pkg-win         # Build Windows executable
npm run pkg-all         # Build all platform executables
```

## Code Architecture

### Execution Flow
1. **index.ts** - Entry point that sets up yargs CLI and signal handlers
2. **handler.ts** - Main orchestrator that determines execution mode (pipeline/list/preview/etc)
3. **Parser.create()** - Parses .gitlab-ci.yml, processes includes/extends, creates Job objects
4. **Commander** - Routes to appropriate execution strategy (runPipeline/runJobs/runJobsInStage)
5. **Executor.runLoop()** - Executes jobs respecting stages/needs dependencies
6. **Job.start()** - Runs individual job via shell or docker executor

### Key Components

**Parser** ([src/parser.ts](src/parser.ts))
- Parses .gitlab-ci.yml files with includes, extends, and variable expansion
- Handles local, remote, project, and template includes via ParserIncludes
- Creates Job instances for each job in the pipeline
- Validates configuration and generates expanded-gitlab-ci.yml for debugging

**Job** ([src/job.ts](src/job.ts))
- Represents a single CI/CD job with all its properties (script, variables, artifacts, cache, etc.)
- Executes jobs via shell or docker executor
- Manages artifacts, cache, and dotenv files
- Handles before_script, script, and after_script execution
- Supports decorators: @Description, @Interactive, @InjectSSHAgent, @NoArtifactsToSource

**Executor** ([src/executor.ts](src/executor.ts))
- Manages job execution order based on stages and needs (DAG)
- Determines which jobs can start based on dependencies
- Handles concurrency limits
- Respects when conditions (on_success, on_failure, manual, never)

**Commander** ([src/commander.ts](src/commander.ts))
- Provides execution strategies: runPipeline, runJobs, runJobsInStage
- Generates job lists (--list, --list-csv)
- Prints execution reports with timing and status

**DataExpander** ([src/data-expander.ts](src/data-expander.ts))
- Expands variables in job definitions
- Handles variable precedence (CLI > job > global > predefined)
- Processes GitLab CI variable syntax ($VAR, ${VAR}, $$VAR)

**VariablesFromFiles** ([src/variables-from-files.ts](src/variables-from-files.ts))
- Loads variables from home files (~/.gitlab-ci-local/variables.yml)
- Loads variables from project files (.gitlab-ci-local-variables.yml)
- Supports remote variable files
- Handles environment-scoped variables

### State Management

The tool maintains state in `.gitlab-ci-local/` directory:
- **artifacts/** - Docker executor job artifacts
- **builds/** - Isolated builds for shell-isolation mode
- **cache/** - Job cache storage
- **docker/** - Rsync'd tracked files for docker jobs
- **expanded-gitlab-ci.yml** - Fully expanded configuration for debugging
- **pipeline-iid.txt** - Pipeline incrementing ID

### Test Structure

Tests are located in `tests/` with two main categories:

1. **Unit tests** - Direct component tests (e.g., parser-includes.test.ts, rules.test.ts)
2. **Integration tests** - In `tests/test-cases/*/integration.test.ts`
   - Each test case has its own directory with `.gitlab-ci.yml` and test file
   - Tests use WriteStreamsMock to capture output
   - Tests call handler() directly with test arguments
   - 126+ test cases covering various features

## Important Concepts

### Executors
- **Shell executor**: Runs commands directly on host (faster, less isolated)
- **Docker executor**: Runs commands in containers (slower, fully isolated)
- Use `--shell-isolation` for artifact isolation in shell mode
- Use `--force-shell-executor` to force all jobs to shell (trusted jobs only)

### Job Dependencies
- **stages**: Traditional sequential stage ordering (.test → build → deploy)
- **needs**: DAG-based dependencies allowing jobs to run out of stage order
- **dependencies**: Controls which job artifacts are downloaded (deprecated, use needs.artifacts)

### Decorators (Special Comments)
Place above job definitions in .gitlab-ci.yml:
- `# @Description <text>` - Adds description to --list output
- `# @Interactive` - Allows interactive containers (docker run -it)
- `# @InjectSSHAgent` - Injects SSH agent into container
- `# @NoArtifactsToSource` - Prevents artifact copying to source folder

### Variable Sources (Precedence Order)
1. CLI variables (--variable KEY=value)
2. Job-level variables
3. Global variables
4. Project file variables (.gitlab-ci-local-variables.yml)
5. Home file variables (~/.gitlab-ci-local/variables.yml)
6. Remote variables (--remote-variables)
7. Predefined variables (CI_*, GITLAB_*)

## Common Patterns

### Adding New CLI Options
1. Add option in [src/index.ts](src/index.ts) yargs configuration
2. Add default value to Argv.default in [src/argv.ts](src/argv.ts)
3. Update Argv interface if needed
4. Use via argv parameter in handler/parser/job

### Adding New Job Features
1. Update Job class in [src/job.ts](src/job.ts) with new property
2. Handle in DataExpander if it requires variable expansion
3. Add to Validator if it needs validation
4. Add integration test in tests/test-cases/

### Parser Includes
External includes are cached. Use `--fetch-includes` to force re-fetch. Include resolution happens in [src/parser-includes.ts](src/parser-includes.ts) with support for:
- Local: `include: local: '.gitlab-ci-template.yml'`
- Remote: `include: remote: 'https://...'`
- Project: `include: project: 'group/project' file: 'template.yml'`
- Template: `include: template: 'Security/SAST.gitlab-ci.yml'`

## Project Constraints

- Requires Node.js 18+
- Uses ES modules (type: "module" in package.json)
- TypeScript with strict mode enabled
- All source imports must use .js extension (TypeScript ES modules requirement)
- Jest tests use experimental VM modules (`NODE_OPTIONS="--experimental-vm-modules"`)
- Maximum child pipeline depth: 2 levels
