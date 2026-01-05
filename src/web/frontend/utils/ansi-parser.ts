/**
 * ANSI escape code parser for terminal output coloring
 */

/**
 * ANSI escape code color map
 */
const ANSI_COLOR_MAP: Record<string, string> = {
    "30": "ansi-black",
    "31": "ansi-red",
    "32": "ansi-green",
    "33": "ansi-yellow",
    "34": "ansi-blue",
    "35": "ansi-magenta",
    "36": "ansi-cyan",
    "37": "ansi-white",
    "90": "ansi-bright-black",
    "91": "ansi-bright-red",
    "92": "ansi-bright-green",
    "93": "ansi-bright-yellow",
    "94": "ansi-bright-blue",
    "95": "ansi-bright-magenta",
    "96": "ansi-bright-cyan",
    "97": "ansi-bright-white",
    "40": "ansi-bg-black",
    "41": "ansi-bg-red",
    "42": "ansi-bg-green",
    "43": "ansi-bg-yellow",
    "44": "ansi-bg-blue",
    "45": "ansi-bg-magenta",
    "46": "ansi-bg-cyan",
    "47": "ansi-bg-white",
    "1": "ansi-bold",
    "2": "ansi-dim",
    "3": "ansi-italic",
    "4": "ansi-underline",
};

/**
 * Escape HTML special characters
 */
function escapeHtml (text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Parse ANSI escape codes and convert to HTML with CSS classes
 */
export function parseAnsiColors (text: string): string {
    let result = "";
    let activeClasses: string[] = [];

    // Normalize ANSI escape sequences
    // eslint-disable-next-line no-control-regex
    const escaped = escapeHtml(text.replace(/\x1b\[|\u001b\[/g, "\x1b["));

    // Split by ANSI escape sequences
    // eslint-disable-next-line no-control-regex
    const parts = escaped.split(/(\x1b\[[0-9;]*m)/g);

    for (const part of parts) {
        // eslint-disable-next-line no-control-regex
        const match = part.match(/^\x1b\[([0-9;]*)m$/);
        if (match) {
            const codes = match[1].split(";");
            for (const code of codes) {
                if (code === "0" || code === "") {
                    activeClasses = [];
                } else if (ANSI_COLOR_MAP[code]) {
                    activeClasses.push(ANSI_COLOR_MAP[code]);
                }
            }
        } else if (part) {
            if (activeClasses.length > 0) {
                result += `<span class="${activeClasses.join(" ")}">${part}</span>`;
            } else {
                result += part;
            }
        }
    }

    return result || escapeHtml(text);
}
