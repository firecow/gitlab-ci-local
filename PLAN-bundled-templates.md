# Plan: Bundle GitLab CI Templates in gitlab-ci-local

## Overview
Add support for bundled GitLab CI templates so `include: template:` directives can resolve locally without network access, with fallback to online fetching for non-bundled or updated templates.

## User Requirements
- **Bundle method**: Git submodule (sparse checkout of gitlab-org/gitlab)
- **Default behavior**: Use bundled templates only (offline by default)
- **Online fallback**: Opt-in via `--online-templates` flag to fetch from GitLab if not bundled
- **Scope**: Common templates only (Workflows/, Jobs/, Security/)

---

## Implementation Steps

### Step 1: Set Up Git Submodule (Sparse Checkout)

The gitlab-org/gitlab repo is ~5GB. We only need the templates directory (~50 files).

```bash
# Add submodule without cloning content
git submodule add --name gitlab-templates https://gitlab.com/gitlab-org/gitlab.git vendor/gitlab-templates

# Configure sparse checkout
cd vendor/gitlab-templates
git sparse-checkout init --cone
git sparse-checkout set lib/gitlab/ci/templates/Workflows lib/gitlab/ci/templates/Jobs lib/gitlab/ci/templates/Security
cd ../..
```

**Create `.gitmodules`:**
```ini
[submodule "gitlab-templates"]
    path = vendor/gitlab-templates
    url = https://gitlab.com/gitlab-org/gitlab.git
    shallow = true
```

---

### Step 2: Create Build Script for Template Embedding

**Create `scripts/generate-bundled-templates.ts`:**

This script reads template files from the submodule and generates a TypeScript file with embedded content (following the `src/web/frontend/embedded.ts` pattern).

```typescript
// Reads vendor/gitlab-templates/lib/gitlab/ci/templates/{Workflows,Jobs,Security}
// Generates src/bundled-templates.ts with:
export const BUNDLED_TEMPLATES: Record<string, string> = {
    "Workflows/MergeRequest-Pipelines.gitlab-ci.yml": `...content...`,
    "Jobs/Build.gitlab-ci.yml": `...content...`,
    // etc.
};
```

---

### Step 3: Update Build Process

**Modify `package.json`:**
```json
{
  "scripts": {
    "generate-templates": "tsx scripts/generate-bundled-templates.ts",
    "prebuild": "npm run generate-templates",
    "preesbuild": "npm run generate-templates"
  }
}
```

**Update `.gitignore`:**
```
src/bundled-templates.ts
```

---

### Step 4: Modify Template Resolution Logic

**File: `src/parser-includes.ts`**

1. Import bundled templates:
```typescript
import { BUNDLED_TEMPLATES } from "./bundled-templates.js";
```

2. Add helper method:
```typescript
static getBundledTemplate(templateName: string): string | null {
    return BUNDLED_TEMPLATES[templateName] ?? null;
}
```

3. Modify template handling in `init()` (lines 84-87 and 154-160):

**Download phase (~line 84):**
```typescript
} else if (value["template"]) {
    const bundledContent = this.getBundledTemplate(value["template"]);
    if (!bundledContent && argv.onlineTemplates) {
        // Not bundled and online mode enabled - fetch from GitLab
        const {project, ref, file, domain} = this.covertTemplateToProjectFile(value["template"]);
        const url = `https://${domain}/${project}/-/raw/${ref}/${file}`;
        promises.push(this.downloadIncludeRemote(cwd, stateDir, url, fetchIncludes));
    }
}
```

**Load phase (~line 154):**
```typescript
} else if (value["template"]) {
    const bundledContent = this.getBundledTemplate(value["template"]);
    let fileDoc;
    if (bundledContent) {
        fileDoc = yaml.load(bundledContent) as any;
        if (value.inputs) {
            fileDoc = Parser.applyInputs(fileDoc, value.inputs);
        }
    } else if (argv.onlineTemplates) {
        // Fallback to downloaded file (only if online mode enabled)
        const {project, ref, file, domain} = this.covertTemplateToProjectFile(value["template"]);
        const fsUrl = Utils.fsUrl(`https://${domain}/${project}/-/raw/${ref}/${file}`);
        fileDoc = await Parser.loadYaml(
            `${cwd}/${stateDir}/includes/${fsUrl}`, {inputs: value.inputs || {}}, expandVariables,
        );
    } else {
        throw new AssertionError({
            message: `Template '${value["template"]}' not found in bundled templates. ` +
                     `Use --online-templates to fetch from GitLab.`
        });
    }
    includeDatas = includeDatas.concat(await this.init(fileDoc, opts));
}
```

---

### Step 5: Add --online-templates CLI Flag

**File: `src/index.ts`** (~line 322):
```typescript
.option("online-templates", {
    type: "boolean",
    description: "Fetch templates from GitLab if not found in bundled templates",
    requiresArg: false,
    default: false,
})
```

**File: `src/argv.ts`:**
```typescript
get onlineTemplates(): boolean {
    return this.map.get("onlineTemplates") ?? false;
}
```

---

### Step 6: Add Tests

**Create `tests/bundled-templates.test.ts`:**
```typescript
import { BUNDLED_TEMPLATES } from "../src/bundled-templates.js";
import { ParserIncludes } from "../src/parser-includes.js";

describe("Bundled Templates", () => {
    test("common templates are bundled", () => {
        expect(BUNDLED_TEMPLATES["Workflows/MergeRequest-Pipelines.gitlab-ci.yml"]).toBeDefined();
    });

    test("getBundledTemplate returns content for bundled template", () => {
        const content = ParserIncludes.getBundledTemplate("Workflows/MergeRequest-Pipelines.gitlab-ci.yml");
        expect(content).not.toBeNull();
        expect(content).toContain("workflow:");
    });

    test("getBundledTemplate returns null for unknown template", () => {
        const content = ParserIncludes.getBundledTemplate("Unknown/NonExistent.yml");
        expect(content).toBeNull();
    });
});
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `.gitmodules` | Create | Configure sparse git submodule |
| `vendor/gitlab-templates/` | Create (submodule) | GitLab templates source |
| `scripts/generate-bundled-templates.ts` | Create | Build script to embed templates |
| `src/bundled-templates.ts` | Create (auto-generated) | Embedded template content |
| `src/parser-includes.ts` | Modify | Add bundled template resolution |
| `src/index.ts` | Modify | Add --online-templates flag |
| `src/argv.ts` | Modify | Add onlineTemplates getter |
| `package.json` | Modify | Add generate-templates script |
| `.gitignore` | Modify | Add src/bundled-templates.ts |
| `tests/bundled-templates.test.ts` | Create | Unit tests |

---

## Trade-offs

**Pros:**
- Offline support for common templates
- Faster execution (no network roundtrip)
- Reliable builds even when GitLab is down
- Follows existing embedding pattern (consistent with `embedded.ts`)

**Cons:**
- Templates become stale (need periodic submodule updates)
- Increases binary size (~100-500KB for ~50 templates)
- Build process depends on submodule initialization

**Mitigation:**
- Fallback to online ensures non-bundled templates still work
- Document monthly update schedule for maintainers
