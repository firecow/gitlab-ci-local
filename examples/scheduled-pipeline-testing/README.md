<!-- SPDX-License-Identifier: BSD-2-Clause -->
<!-- Copyright (c) 2025, Timo Pallach (timo@pallach.de). -->

# Scheduled Pipeline Testing Example

This example demonstrates how to use GitLab CI Local to test complex scheduled pipeline configurations locally, including conditional includes and complex rules logic.

## Overview

Scheduled pipelines in GitLab CI often have complex conditional logic that can be difficult to test without pushing to the repository. This example shows how to use the new `--pipeline-source` and `--schedule-name` options to simulate scheduled pipelines locally.

## Getting Started

### Prerequisites

You need **Node.js** installed on your system. If you don't have it:

```bash
# macOS (with Homebrew)
brew install node

# Ubuntu/Debian
sudo apt install nodejs npm

# Windows
# Download from https://nodejs.org/
```

### Quick Start (Simplest Path)

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone https://github.com/firecow/gitlab-ci-local.git
   cd gitlab-ci-local
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Navigate to the example**:
   ```bash
   cd examples/scheduled-pipeline-testing
   ```

4. **Run your first test**:
   ```bash
   # Test standard development pipeline
   npx tsx ../../src/index.ts --pipeline-source push --list
   
   # Test scheduled pipeline
   npx tsx ../../src/index.ts --pipeline-source schedule --list
   ```

**That's it!** You should see the jobs listed for each pipeline type.

### What You'll See

When you run the commands, you should see output like this:

```bash
$ npx tsx ../../src/index.ts --pipeline-source push --list
parsing and downloads finished in 489 ms.
json schema validated in 101 ms
name                   description  stage    when    allow_failure  needs
standard-job                        test     always  false      
always-job                          test     always  false      
web-triggered-job                   test     always  false      
api-triggered-job                   test     always  false      
external-job                        test     always  false      

$ npx tsx ../../src/index.ts --pipeline-source schedule --list
parsing and downloads finished in 454 ms.
json schema validated in 98 ms
name                   description  stage    when    allow_failure  needs
scheduled-job                       test     always  false      
always-job                          test     always  false      
```

**Expected Results:**
- **`push` pipeline**: Shows `standard-job`, `web-triggered-job`, `api-triggered-job`, `external-job`, `always-job`
- **`schedule` pipeline**: Shows `scheduled-job`, `always-job`
- **`always-job`**: Shows in ALL pipeline types (as expected)

### Alternative Running Options

#### Option 1: From Project Root (Recommended for Development)
```bash
# Stay in the gitlab-ci-local project root
npx tsx src/index.ts --pipeline-source push --list --cwd examples/scheduled-pipeline-testing
npx tsx src/index.ts --pipeline-source schedule --list --cwd examples/scheduled-pipeline-testing
```

#### Option 2: Build and Use Binary
```bash
# Build the project
npm run build

# Use the compiled binary
./dist/index.js --pipeline-source push --list --cwd examples/scheduled-pipeline-testing
```

#### Option 3: Copy Example to Your Own Project
```bash
# Copy the example files to your own project
cp -r examples/scheduled-pipeline-testing /path/to/your/project/
cd /path/to/your/project/scheduled-pipeline-testing

# Then use gitlab-ci-local from your project
gitlab-ci-local --pipeline-source push --list
```

## Features Demonstrated

- **Pipeline Source Simulation**: Test different pipeline trigger types
- **Schedule Name Testing**: Test specific schedule configurations
- **Conditional Include Logic**: Test complex `rules` and conditional logic
- **Job Dependency Validation**: Verify job inclusion/exclusion based on conditions

## Example GitLab CI Configuration

The `.gitlab-ci.yml` file in this example demonstrates:

```yaml
# Standard pipeline components (development, merge requests)
include:
  - local: '.gitlab-ci/standard-pipeline.yml'
    rules:
      - if: $CI_PIPELINE_SOURCE != "schedule"
        when: always

# Scheduled pipeline components
include:
  - local: '.gitlab-ci/scheduled-pipeline.yml'
    rules:
      - if: $CI_PIPELINE_SOURCE == "schedule"
        when: always
```

## Testing Scenarios

### 1. Standard Development Pipeline

Test the normal development pipeline behavior:

```bash
npx tsx ../../src/index.ts --pipeline-source push --list
```

This will show only the standard pipeline jobs, excluding scheduled pipeline components.

### 2. Scheduled Pipeline Testing

Test a scheduled pipeline without specifying a schedule name:

```bash
npx tsx ../../src/index.ts --pipeline-source schedule --list
```

This will show scheduled pipeline jobs but may not include schedule-specific conditional logic.

### 3. Specific Schedule Testing

Test a specific schedule with exact name matching:

```bash
npx tsx ../../src/index.ts --pipeline-source schedule --schedule-name "Daily Check" --list
```

This will show jobs that are specifically included for the "Daily Check" schedule.

### 4. Compare Pipeline Types

Compare different pipeline types to understand job inclusion:

```bash
# Development pipeline
gitlab-ci-local --pipeline-source push --list

# Scheduled pipeline
gitlab-ci-local --pipeline-source schedule --list

# Merge request pipeline
gitlab-ci-local --pipeline-source merge_request_event --list
```

## Complex Conditional Logic Testing

This example demonstrates testing complex conditional logic:

```yaml
# Example of complex conditional logic
rules:
  - if: $CI_PIPELINE_SOURCE == "schedule" && $SCHEDULE_NAME == "npm Dependency Update"
    when: always
  - if: $CI_PIPELINE_SOURCE == "schedule" && $SCHEDULE_NAME == "Daily OpenBSD Snapshot Check"
    when: always
  - when: never
```

Test this logic locally:

```bash
# Test npm dependency update schedule
gitlab-ci-local --pipeline-source schedule --schedule-name "npm Dependency Update" --list

# Test OpenBSD snapshot schedule
gitlab-ci-local --pipeline-source schedule --schedule-name "Daily OpenBSD Snapshot Check" --list

# Test other schedule (should show no jobs)
gitlab-ci-local --pipeline-source schedule --schedule-name "Other Schedule" --list
```

## Environment Variable Testing

Test how environment variables affect pipeline behavior:

```bash
# Set environment variables for testing
export CI_PIPELINE_SOURCE=schedule
export SCHEDULE_NAME="npm Dependency Update"

# Run with environment variables
npx tsx ../../src/index.ts --list

# Override with CLI options
npx tsx ../../src/index.ts --pipeline-source schedule --schedule-name "Daily Check" --list
```

## Best Practices

### 1. Use `--list` for Testing

Always use `--list` or `--list-all` when testing pipeline logic to avoid actually executing jobs:

```bash
# Good: Just list jobs
npx tsx ../../src/index.ts --pipeline-source schedule --schedule-name "Daily Check" --list

# Avoid: Actually execute jobs during testing
npx tsx ../../src/index.ts --pipeline-source schedule --schedule-name "Daily Check"
```

### 2. Test Multiple Scenarios

Test various combinations to ensure your conditional logic works correctly:

```bash
# Test all pipeline sources
for source in push schedule merge_request_event web api external chat external_pull_request_event ondemand_dast_scan ondemand_dast_validation parent_pipeline pipeline security_orchestration_policy trigger webide; do
  echo "=== Testing $source pipeline ==="
  npx tsx ../../src/index.ts --pipeline-source $source --list
  echo
done
```

### 3. Validate Conditional Logic

Ensure your `rules` and conditional includes work as expected:

```bash
# Test specific schedule names
npx tsx ../../src/index.ts --pipeline-source schedule --schedule-name "npm Dependency Update" --list
npx tsx ../../src/index.ts --pipeline-source schedule --schedule-name "mix Dependency Update" --list
npx tsx ../../src/index.ts --pipeline-source schedule --schedule-name "Daily OpenBSD Snapshot Check" --list

# Test other pipeline sources
npx tsx ../../src/index.ts --pipeline-source trigger --list
npx tsx ../../src/index.ts --pipeline-source schedule --list
npx tsx ../../src/index.ts --pipeline-source external_pull_request_event --list
npx tsx ../../src/index.ts --pipeline-source ondemand_dast_scan --list
npx tsx ../../src/index.ts --pipeline-source parent_pipeline --list
npx tsx ../../src/index.ts --pipeline-source webide --list
```

## Troubleshooting

### Setup Issues

1. **Node.js Not Found**:
   ```bash
   # Check if Node.js is installed
   node --version
   npm --version
   
   # If not found, install Node.js first
   # macOS: brew install node
   # Ubuntu: sudo apt install nodejs npm
   # Windows: Download from https://nodejs.org/
   ```

2. **Wrong Directory**:
   ```bash
   # Ensure you're in the gitlab-ci-local project root
   pwd
   ls -la package.json
   # Should show the package.json file
   
   # Then navigate to example
   cd examples/scheduled-pipeline-testing
   ls -la .gitlab-ci.yml
   # Should show the example .gitlab-ci.yml file
   ```

3. **Dependencies Not Installed**:
   ```bash
   # Make sure you ran npm install in the project root
   cd ../../  # Go back to project root
   npm install
   cd examples/scheduled-pipeline-testing
   ```

### Pipeline Issues

1. **Jobs Not Showing**: Check if the pipeline source and schedule name match your conditional logic
2. **Unexpected Jobs**: Verify that your `rules` are correctly excluding unwanted jobs
3. **Conditional Includes Not Working**: Ensure your include rules use the correct syntax

### Debug Commands

```bash
# Show all jobs including those set to 'never'
npx tsx ../../src/index.ts --pipeline-source schedule --schedule-name "Daily Check" --list-all

# Check environment variables
npx tsx ../../src/index.ts --pipeline-source schedule --schedule-name "Daily Check" --list --debug

# Compare with standard pipeline
npx tsx ../../src/index.ts --pipeline-source push --list
```

## Advanced Usage

### Testing Complex Rules

For complex rule combinations, test each condition separately:

```bash
# Test individual conditions
npx tsx ../../src/index.ts --pipeline-source schedule --list
npx tsx ../../src/index.ts --pipeline-source merge_request_event --list
npx tsx ../../src/index.ts --pipeline-source push --list

# Test specific combinations
npx tsx ../../src/index.ts --pipeline-source schedule --schedule-name "Specific Schedule" --list
```

### Integration with CI/CD

Use these testing techniques in your development workflow:

1. **Pre-commit Testing**: Test pipeline changes locally before committing
2. **Branch Testing**: Test different pipeline configurations on feature branches
3. **Release Testing**: Verify pipeline behavior before releases

## Conclusion

This example demonstrates how GitLab CI Local's new pipeline simulation features can significantly improve your development workflow by allowing you to test complex pipeline configurations locally without pushing to the repository.

By using `--pipeline-source` and `--schedule-name`, you can:

- Test scheduled pipeline logic locally
- Validate conditional include rules
- Debug complex pipeline configurations
- Ensure pipeline changes work as expected before committing

This leads to faster development cycles, fewer pipeline failures, and more confident deployments.
