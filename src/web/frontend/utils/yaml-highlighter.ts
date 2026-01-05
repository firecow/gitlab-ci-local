/**
 * YAML syntax highlighter for the web UI
 */

import {escapeHtml} from "./format-utils.js";

// GitLab CI/CD keywords for special highlighting
const GITLAB_KEYWORDS = [
    "stages", "variables", "before_script", "after_script", "script",
    "image", "services", "cache", "artifacts", "dependencies", "needs",
    "rules", "only", "except", "when", "allow_failure", "retry", "timeout",
    "include", "extends", "trigger", "parallel", "resource_group",
    "environment", "coverage", "interruptible", "tags", "stage", "default",
    "workflow", "pages", "release", "secrets", "id_tokens",
];

/**
 * Highlight a value within YAML (handles strings, numbers, booleans, etc.)
 */
function highlightValue (text: string): string {
    if (!text) return "";

    // Boolean values (standalone)
    if (/^(true|false)$/.test(text.trim())) {
        return `<span class="yaml-boolean">${text}</span>`;
    }

    // Null values (standalone)
    if (/^(null|~)$/.test(text.trim())) {
        return `<span class="yaml-null">${text}</span>`;
    }

    // Numbers (standalone)
    if (/^-?\d+\.?\d*$/.test(text.trim())) {
        return `<span class="yaml-number">${text}</span>`;
    }

    // Tokenize the text to avoid overlapping matches
    const tokens: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        let match: RegExpMatchArray | null;

        // Double-quoted string
        if ((match = remaining.match(/^("[^"]*")/))) {
            tokens.push(`<span class="yaml-string">${match[1]}</span>`);
            remaining = remaining.slice(match[1].length);
        }
        // Single-quoted string
        else if ((match = remaining.match(/^('[^']*')/))) {
            tokens.push(`<span class="yaml-string">${match[1]}</span>`);
            remaining = remaining.slice(match[1].length);
        }
        // Anchor &name (HTML escaped)
        else if ((match = remaining.match(/^(&amp;[a-zA-Z_][a-zA-Z0-9_-]*)/))) {
            tokens.push(`<span class="yaml-anchor">${match[1]}</span>`);
            remaining = remaining.slice(match[1].length);
        }
        // Alias *name
        else if ((match = remaining.match(/^(\*[a-zA-Z_][a-zA-Z0-9_-]*)/))) {
            tokens.push(`<span class="yaml-alias">${match[1]}</span>`);
            remaining = remaining.slice(match[1].length);
        }
        // Variable ${VAR}
        else if ((match = remaining.match(/^(\$\{[A-Za-z_][A-Za-z0-9_]*\})/))) {
            tokens.push(`<span class="yaml-variable">${match[1]}</span>`);
            remaining = remaining.slice(match[1].length);
        }
        // Variable $VAR
        else if ((match = remaining.match(/^(\$[A-Za-z_][A-Za-z0-9_]*)/))) {
            tokens.push(`<span class="yaml-variable">${match[1]}</span>`);
            remaining = remaining.slice(match[1].length);
        }
        // Inline comment
        else if ((match = remaining.match(/^(\s)(#.*)$/))) {
            tokens.push(match[1] + `<span class="yaml-comment">${match[2]}</span>`);
            remaining = "";
        }
        // Plain character - consume one character at a time
        else {
            tokens.push(remaining[0]);
            remaining = remaining.slice(1);
        }
    }

    return tokens.join("");
}

/**
 * Highlight YAML content with syntax coloring
 */
export function highlightYaml (content: string): string {
    const lines = content.split("\n");

    return lines.map((line, i) => {
        const escaped = escapeHtml(line);
        let result = "";

        // Full line comments
        if (/^\s*#/.test(line)) {
            result = `<span class="yaml-comment">${escaped}</span>`;
        } else {
            // Parse the line structure
            const listMatch = escaped.match(/^(\s*)(-)(\s)(.*)$/);
            const keyMatch = escaped.match(/^(\s*)([\w.-]+):(\s*)(.*)$/);

            if (listMatch) {
                // List item: "  - value"
                const indent = listMatch[1];
                const value = listMatch[4];
                result = indent + "<span class=\"yaml-list-marker\">-</span> " + highlightValue(value);
            } else if (keyMatch) {
                // Key-value: "key: value"
                const kindent = keyMatch[1];
                const key = keyMatch[2];
                const spacing = keyMatch[3];
                const val = keyMatch[4];
                const keyClass = GITLAB_KEYWORDS.includes(key) ? "yaml-keyword" : "yaml-key";
                result = kindent + `<span class="${keyClass}">${key}</span>:` + spacing + highlightValue(val);
            } else {
                // Plain text or continuation
                result = highlightValue(escaped);
            }
        }

        return `<div class="yaml-line"><span class="yaml-line-number">${i + 1}</span><span class="yaml-content">${result}</span></div>`;
    }).join("");
}
