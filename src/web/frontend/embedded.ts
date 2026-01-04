// Embedded frontend files for pkg binary compatibility
// This avoids the need for pkg to include static assets

export const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitLab CI Local - Web UI</title>
    <style>
        :root {
            --bg-color: #1a1a2e;
            --surface-color: #16213e;
            --text-color: #eee;
            --text-muted: #888;
            --accent-color: #f8c22fff;
            --success-color: #4caf50;
            --warning-color: #ff8800ff;
            --error-color: #f81515ff;
            --border-color: #2a2a4a;
            --hover-color: #1f2f4f;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg-color); color: var(--text-color); line-height: 1.5; }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }
        .container.full-width { max-width: none; padding-right: 0; }
        .app-header { background: var(--surface-color); border-bottom: 1px solid var(--border-color); padding: 1rem 0; }
        .header-content { display: flex; justify-content: space-between; align-items: center; }
        .app-title { font-size: 1.25rem; font-weight: 600; }
        .logo { color: var(--text-color); text-decoration: none; }
        .logo:hover { opacity: 0.8; }
        .app-nav { display: flex; gap: 1rem; }
        .nav-link { color: var(--text-muted); text-decoration: none; padding: 0.5rem 1rem; border-radius: 4px; transition: all 0.2s; }
        .nav-link:hover { color: var(--text-color); background: var(--hover-color); }
        .nav-link.active { color: var(--accent-color); background: var(--hover-color); }
        .app-main { padding: 2rem 0; }
        .card { background: var(--surface-color); border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 1rem; overflow: hidden; }
        .card-header { padding: 1rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
        .card-body { padding: 1rem; }
        .badge { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
        .badge-success { background: var(--success-color); color: white; }
        .badge-warning { background: var(--warning-color); color: black; }
        .badge-error { background: var(--error-color); color: white; }
        .badge-running { background: var(--accent-color); color: white; animation: pulse 1.5s infinite; }
        .badge-pending { background: var(--text-muted); color: white; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        .pipeline-row { padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s; }
        .pipeline-row:hover { background: var(--hover-color); }
        .pipeline-row:last-child { border-bottom: none; }
        .pipeline-info { display: flex; align-items: center; gap: 1rem; }
        .pipeline-id { font-weight: 600; color: var(--accent-color); }
        .pipeline-branch { color: var(--text-muted); }
        .pipeline-time { color: var(--text-muted); font-size: 0.875rem; }
        .empty-state { text-align: center; padding: 3rem; color: var(--text-muted); }
        .empty-state-icon { font-size: 3rem; margin-bottom: 1rem; }
        .loading { display: flex; justify-content: center; padding: 2rem; }
        .spinner { width: 40px; height: 40px; border: 4px solid var(--border-color); border-top-color: var(--accent-color); border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .jobs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.5rem; }
        .job-card { background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 6px; padding: 0.75rem; cursor: pointer; transition: all 0.2s; }
        .job-card:hover { border-color: var(--accent-color); transform: translateY(-2px); }
        .job-name { font-weight: 500; margin-bottom: 0.25rem; }
        .job-stage { font-size: 0.75rem; color: var(--text-muted); }
        .dag-container { overflow-x: auto; padding: 1rem 0; position: relative; }
        .dag-lines { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; }
        .dag-line { stroke: var(--border-color); stroke-width: 2; fill: none; opacity: 0.6; marker-end: url(#arrowhead); }
        .dag-line-same-stage { stroke: var(--accent-color); opacity: 0.8; }
        .dag-stages { display: flex; gap: 2rem; min-width: max-content; align-items: flex-start; position: relative; z-index: 2; }
        .dag-stage { min-width: 100px; display: flex; flex-direction: column; align-items: center; }
        .dag-stage-header { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 1rem; padding: 0.25rem 0.75rem; background: var(--hover-color); border-radius: 12px; text-align: center; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; cursor: pointer; transition: all 0.2s; }
        .dag-stage-header:hover { background: var(--border-color); }
        .run-stage-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.7rem; padding: 0; opacity: 0; transition: opacity 0.2s; }
        .dag-stage-header:hover .run-stage-btn { opacity: 1; }
        .run-stage-btn:hover { color: var(--accent-color); }
        .dag-jobs { display: flex; flex-direction: column; gap: 1rem; align-items: center; }
        .dag-job { width: 48px; height: 48px; border-radius: 50%; cursor: pointer; transition: all 0.2s; position: relative; display: flex; align-items: center; justify-content: center; border: none; background: var(--border-color); color: white; }
        .dag-job:hover { transform: scale(1.1); box-shadow: 0 0 12px rgba(233, 69, 96, 0.5); }
        .dag-job.selected { box-shadow: 0 0 0 3px var(--accent-color); }
        .dag-job.status-success { background: var(--success-color); }
        .dag-job.status-failed { background: var(--error-color); }
        .dag-job.status-warning { background: var(--warning-color); color: black; }
        .dag-job.status-running { background: var(--accent-color); animation: pulse-ring 1.5s infinite; }
        .dag-job.status-pending { background: var(--text-muted); }
        @keyframes pulse-ring { 0%, 100% { box-shadow: 0 0 0 0 rgba(233, 69, 96, 0.4); } 50% { box-shadow: 0 0 0 8px rgba(233, 69, 96, 0); } }
        .dag-job-icon { font-size: 1.1rem; color: inherit; }
        .dag-job-tooltip { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: var(--surface-color); border: 1px solid var(--border-color); padding: 0.5rem 0.75rem; border-radius: 6px; white-space: nowrap; font-size: 0.75rem; opacity: 0; visibility: hidden; transition: all 0.2s; z-index: 1000; pointer-events: none; margin-bottom: 8px; color: var(--text-color); }
        .dag-job-tooltip::after { content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border: 6px solid transparent; border-top-color: var(--border-color); }
        .dag-job:hover .dag-job-tooltip { opacity: 1; visibility: visible; }
        .dag-job-tooltip-name { font-weight: 600; margin-bottom: 0.25rem; color: var(--text-color); }
        .dag-job-tooltip-info { color: var(--text-muted); }
        .dag-legend { display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; position: relative; z-index: 1; }
        .dag-legend-item { display: flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: var(--text-muted); }
        .dag-legend-color { width: 16px; height: 16px; border-radius: 50%; border: 2px solid; }
        .split-view { display: flex; gap: 0; height: calc(100vh - 120px); min-height: 500px; width: 100%; overflow: hidden; }
        .split-left { flex: 0 0 350px; overflow: auto; min-width: 200px; max-width: 80%; padding-right: 0.5rem; }
        .split-left.full-width { flex: 1; max-width: none; }
        .split-divider { flex: 0 0 6px; background: var(--border-color); cursor: col-resize; position: relative; transition: background 0.2s; }
        .split-divider:hover, .split-divider.dragging { background: var(--accent-color); }
        .split-divider::before { content: ''; position: absolute; left: -4px; right: -4px; top: 0; bottom: 0; }
        .split-right { flex: 1; display: flex; flex-direction: column; background: var(--surface-color); border-radius: 0; border: 1px solid var(--border-color); border-left: none; overflow: hidden; min-height: 0; min-width: 200px; }
        .split-right-header { padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--hover-color); }
        .split-right-header h3 { font-size: 0.9rem; font-weight: 600; }
        .split-right-body { flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0; }
        .live-log-viewer { flex: 1; background: #0d1117; color: #c9d1d9; font-family: 'Monaco', 'Menlo', 'Consolas', monospace; font-size: 0.75rem; overflow: auto; padding: 0.5rem; min-height: 0; }
        .live-log-line { display: flex; line-height: 1.4; }
        .live-log-line-number { color: #484f58; min-width: 40px; text-align: right; padding-right: 0.75rem; user-select: none; }
        .live-log-content { white-space: pre-wrap; word-break: break-all; }
        .close-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0.25rem; font-size: 1.2rem; line-height: 1; }
        .close-btn:hover { color: var(--text-color); }
        .header-actions { display: flex; gap: 0.5rem; align-items: center; }
        .run-job-btn { background: var(--accent-color); border: none; color: black; cursor: pointer; padding: 0.25rem 0.75rem; font-size: 0.75rem; border-radius: 4px; font-weight: 500; transition: all 0.2s; }
        .run-job-btn:hover { opacity: 0.9; transform: scale(1.02); }
        .run-job-btn:disabled { background: var(--text-muted); cursor: not-allowed; opacity: 0.6; }
        .log-status-bar { padding: 0.5rem 1rem; border-top: 1px solid var(--border-color); font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center; background: var(--hover-color); }
        .auto-scroll-indicator { display: flex; align-items: center; gap: 0.5rem; }
        .auto-scroll-indicator.active { color: var(--success-color); }
        /* ANSI color classes */
        .ansi-black { color: #586e75; } .ansi-red { color: #dc322f; } .ansi-green { color: #859900; } .ansi-yellow { color: #b58900; }
        .ansi-blue { color: #268bd2; } .ansi-magenta { color: #d33682; } .ansi-cyan { color: #2aa198; } .ansi-white { color: #eee8d5; }
        .ansi-bright-black { color: #657b83; } .ansi-bright-red { color: #cb4b16; } .ansi-bright-green { color: #98c379; } .ansi-bright-yellow { color: #e5c07b; }
        .ansi-bright-blue { color: #83a598; } .ansi-bright-magenta { color: #c678dd; } .ansi-bright-cyan { color: #56b6c2; } .ansi-bright-white { color: #fdf6e3; }
        .ansi-bg-black { background: #002b36; } .ansi-bg-red { background: #dc322f; } .ansi-bg-green { background: #859900; } .ansi-bg-yellow { background: #b58900; }
        .ansi-bg-blue { background: #268bd2; } .ansi-bg-magenta { background: #d33682; } .ansi-bg-cyan { background: #2aa198; } .ansi-bg-white { background: #eee8d5; }
        .ansi-bold { font-weight: bold; } .ansi-dim { opacity: 0.7; } .ansi-italic { font-style: italic; } .ansi-underline { text-decoration: underline; }
        .artifacts-container { margin-top: 1rem; }
        .artifact-list { display: flex; flex-direction: column; gap: 0.25rem; }
        .artifact-item { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 4px; transition: all 0.2s; }
        .artifact-item:hover { border-color: var(--accent-color); }
        .artifact-info { display: flex; align-items: center; gap: 0.5rem; }
        .artifact-icon { color: var(--text-muted); }
        .artifact-name { font-family: monospace; font-size: 0.85rem; }
        .artifact-size { font-size: 0.75rem; color: var(--text-muted); }
        .artifact-download { color: var(--accent-color); text-decoration: none; font-size: 0.75rem; padding: 0.25rem 0.5rem; border: 1px solid var(--accent-color); border-radius: 4px; transition: all 0.2s; }
        .artifact-download:hover { background: var(--accent-color); color: white; }
        .tabs { display: flex; gap: 0; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); }
        .tab { padding: 0.5rem 1rem; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; color: var(--text-muted); }
        .tab:hover { color: var(--text-color); }
        .tab.active { color: var(--accent-color); border-bottom-color: var(--accent-color); }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .log-viewer, .yaml-viewer { background: #0d1117; color: #c9d1d9; font-family: 'Monaco', 'Menlo', 'Consolas', monospace; font-size: 0.8rem; padding: 1rem; max-height: 600px; overflow: auto; border-radius: 4px; white-space: pre; tab-size: 2; }
        .log-line { display: flex; }
        .log-line-number { color: #484f58; width: 50px; text-align: right; padding-right: 1rem; user-select: none; }
        .yaml-line { display: flex; }
        .yaml-line-number { color: #484f58; min-width: 40px; text-align: right; padding-right: 1rem; user-select: none; }
        .yaml-content { flex: 1; }
        .yaml-key { color: #7ee787; }
        .yaml-string { color: #a5d6ff; }
        .yaml-number { color: #79c0ff; }
        .yaml-boolean { color: #ff7b72; }
        .yaml-null { color: #ff7b72; font-style: italic; }
        .yaml-anchor { color: #d2a8ff; }
        .yaml-alias { color: #d2a8ff; }
        .yaml-tag { color: #ffa657; }
        .yaml-comment { color: #8b949e; font-style: italic; }
        .yaml-variable { color: #ffa657; }
        .yaml-keyword { color: #ff7b72; font-weight: 500; }
        .yaml-list-marker { color: #79c0ff; }
        .back-link { color: var(--accent-color); text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; }
        .back-link:hover { text-decoration: underline; }
        h2 { margin-bottom: 1rem; }
        .flex-between { display: flex; justify-content: space-between; align-items: center; }
        .mb-2 { margin-bottom: 0.5rem; }
        .text-muted { color: var(--text-muted); }
        .cwd-info { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem; }
        .btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.875rem; font-weight: 500; cursor: pointer; border: none; transition: all 0.2s; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-primary { background: var(--success-color); color: white; }
        .btn-primary:hover:not(:disabled) { background: #d13550; }
        .btn-secondary { background: var(--border-color); color: var(--text-color); }
        .btn-secondary:hover:not(:disabled) { background: var(--hover-color); }
        .btn-success { background: var(--success-color); color: white; }
        .btn-success:hover:not(:disabled) { background: #43a047; }
        .btn-danger { background: var(--error-color); color: white; }
        .btn-danger:hover:not(:disabled) { background: #e53935; }
        .btn-sm { padding: 0.25rem 0.5rem; font-size: 0.75rem; }
        .btn-group { display: inline-flex; border-radius: 6px; overflow: hidden; border: 1px solid var(--border-color); }
        .btn-group .btn { border-radius: 0; border: none; padding: 0.375rem 0.75rem; }
        .btn-group .btn:not(:last-child) { border-right: 1px solid var(--border-color); }
        .btn-group .btn.active { background: var(--accent-color); color: white; }
        .btn-group .btn:not(.active) { background: var(--surface-color); color: var(--text-muted); }
        .btn-group .btn:not(.active):hover { background: var(--hover-color); color: var(--text-color); }
        .action-bar { display: flex; gap: 0.5rem; align-items: center; }
        .status-indicator { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; }
        .status-dot.running { background: var(--accent-color); animation: pulse 1.5s infinite; }
        .status-dot.idle { background: var(--success-color); }
        .init-progress { margin-top: 0.75rem; padding: 0.75rem; background: var(--bg-color); border-radius: 6px; border: 1px solid var(--border-color); }
        .init-progress-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
        .init-progress-label { font-size: 0.875rem; color: var(--text-color); display: flex; align-items: center; gap: 0.5rem; }
        .init-progress-phase { font-size: 0.75rem; color: var(--text-muted); }
        .init-progress-bar { height: 4px; background: var(--border-color); border-radius: 2px; overflow: hidden; }
        .init-progress-fill { height: 100%; background: var(--accent-color); border-radius: 2px; transition: width 0.3s ease; }
        .init-spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid var(--border-color); border-top-color: var(--accent-color); border-radius: 50%; animation: spin 1s linear infinite; }
    </style>
</head>
<body>
    <header class="app-header">
        <div class="container">
            <div class="header-content">
                <h1 class="app-title">
                    <a href="#/" class="logo">GitLab CI Local</a>
                </h1>
                <nav class="app-nav">
                    <a href="#/" class="nav-link" id="nav-pipelines">Pipelines</a>
                    <a href="#/yaml" class="nav-link" id="nav-yaml">YAML</a>
                    <div class="status-indicator" id="nav-status">
                        <div class="status-dot idle"></div>
                        <span>Ready</span>
                    </div>
                </nav>
            </div>
        </div>
    </header>
    <main class="app-main">
        <div class="container">
            <div id="app-root">
                <div class="loading"><div class="spinner"></div></div>
            </div>
        </div>
    </main>
    <script>
        const API_BASE = '/api';

        function getStatusBadgeClass(status) {
            const map = { success: 'badge-success', failed: 'badge-error', running: 'badge-running', pending: 'badge-pending', canceled: 'badge-warning', skipped: 'badge-warning' };
            return 'badge ' + (map[status] || 'badge-pending');
        }

        function formatTime(timestamp) {
            if (!timestamp) return '';
            return new Date(timestamp).toLocaleString();
        }

        function formatDuration(ms) {
            if (!ms) return '';
            const secs = Math.floor(ms / 1000);
            if (secs < 60) return secs + 's';
            const mins = Math.floor(secs / 60);
            return mins + 'm ' + (secs % 60) + 's';
        }

        async function fetchPipelines() {
            const res = await fetch(API_BASE + '/pipelines');
            return (await res.json()).pipelines || [];
        }

        async function fetchPipeline(id) {
            const res = await fetch(API_BASE + '/pipelines/' + id);
            return await res.json();
        }

        async function fetchJobLogs(jobId, limit) {
            limit = limit || 100000; // Default to 100k lines
            const res = await fetch(API_BASE + '/jobs/' + jobId + '/logs?limit=' + limit);
            return await res.json();
        }

        async function fetchJobArtifacts(jobId) {
            const res = await fetch(API_BASE + '/jobs/' + jobId + '/artifacts');
            return await res.json();
        }

        async function fetchJob(jobId) {
            const res = await fetch(API_BASE + '/jobs/' + jobId);
            return await res.json();
        }

        async function fetchYaml() {
            const res = await fetch(API_BASE + '/config/yaml');
            return await res.json();
        }

        async function fetchExpandedYaml() {
            const res = await fetch(API_BASE + '/config/expanded-yaml');
            return await res.json();
        }

        async function fetchConfig() {
            const res = await fetch(API_BASE + '/config');
            return await res.json();
        }

        async function fetchPipelineStatus() {
            const res = await fetch(API_BASE + '/pipelines/status');
            return await res.json();
        }

        async function fetchPipelineStructure() {
            const res = await fetch(API_BASE + '/pipeline-structure');
            return await res.json();
        }

        async function runPipeline(jobs) {
            const res = await fetch(API_BASE + '/pipelines/run', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: jobs ? JSON.stringify({jobs: jobs}) : '{}'
            });
            return await res.json();
        }

        async function cancelPipeline() {
            const res = await fetch(API_BASE + '/pipelines/cancel', {
                method: 'POST'
            });
            return await res.json();
        }

        async function runSingleJob(jobId) {
            const res = await fetch(API_BASE + '/jobs/' + jobId + '/run', {
                method: 'POST'
            });
            return await res.json();
        }

        async function runStage(stageName) {
            const res = await fetch(API_BASE + '/stages/' + encodeURIComponent(stageName) + '/run', {
                method: 'POST'
            });
            return await res.json();
        }

        var pipelineRunning = false;
        var queuedJobs = []; // Jobs queued to run

        function highlightYaml(content) {
            // Enhanced YAML syntax highlighting
            var lines = content.split('\\n');
            var gitlabKeywords = ['stages', 'variables', 'before_script', 'after_script', 'script', 'image', 'services', 'cache', 'artifacts', 'dependencies', 'needs', 'rules', 'only', 'except', 'when', 'allow_failure', 'retry', 'timeout', 'include', 'extends', 'trigger', 'parallel', 'resource_group', 'environment', 'coverage', 'interruptible', 'tags', 'stage', 'default', 'workflow', 'pages', 'release', 'secrets', 'id_tokens'];
            return lines.map(function(line, i) {
                var escaped = escapeHtml(line);
                var result = '';
                // Full line comments
                if (/^\\s*#/.test(line)) {
                    result = '<span class="yaml-comment">' + escaped + '</span>';
                } else {
                    // Parse the line structure first
                    var listMatch = escaped.match(/^(\\s*)(-)\\s(.*)$/);
                    var keyMatch = escaped.match(/^(\\s*)([\\w.-]+):(\\s*)(.*)$/);
                    if (listMatch) {
                        // List item: "  - value"
                        var indent = listMatch[1];
                        var value = listMatch[3];
                        value = highlightValue(value, gitlabKeywords);
                        result = indent + '<span class="yaml-list-marker">-</span> ' + value;
                    } else if (keyMatch) {
                        // Key-value: "key: value"
                        var kindent = keyMatch[1];
                        var key = keyMatch[2];
                        var spacing = keyMatch[3];
                        var val = keyMatch[4];
                        var keyClass = gitlabKeywords.indexOf(key) !== -1 ? 'yaml-keyword' : 'yaml-key';
                        val = highlightValue(val, gitlabKeywords);
                        result = kindent + '<span class="' + keyClass + '">' + key + '</span>:' + spacing + val;
                    } else {
                        // Plain text or continuation
                        result = highlightValue(escaped, gitlabKeywords);
                    }
                }
                return '<div class="yaml-line"><span class="yaml-line-number">' + (i + 1) + '</span><span class="yaml-content">' + result + '</span></div>';
            }).join('');
        }

        function highlightValue(text, gitlabKeywords) {
            if (!text) return '';
            // Boolean values (standalone)
            if (/^(true|false)$/.test(text.trim())) {
                return '<span class="yaml-boolean">' + text + '</span>';
            }
            // Null values (standalone)
            if (/^(null|~)$/.test(text.trim())) {
                return '<span class="yaml-null">' + text + '</span>';
            }
            // Numbers (standalone)
            if (/^-?\\d+\\.?\\d*$/.test(text.trim())) {
                return '<span class="yaml-number">' + text + '</span>';
            }
            // Tokenize the text to avoid overlapping matches
            // Match: double-quoted strings, single-quoted strings, anchors, aliases, variables, or plain text
            var tokens = [];
            var remaining = text;
            while (remaining.length > 0) {
                var match;
                // Double-quoted string
                if ((match = remaining.match(/^("[^"]*")/))) {
                    tokens.push('<span class="yaml-string">' + match[1] + '</span>');
                    remaining = remaining.slice(match[1].length);
                }
                // Single-quoted string
                else if ((match = remaining.match(/^('[^']*')/))) {
                    tokens.push('<span class="yaml-string">' + match[1] + '</span>');
                    remaining = remaining.slice(match[1].length);
                }
                // Anchor &name
                else if ((match = remaining.match(/^(&amp;[a-zA-Z_][a-zA-Z0-9_-]*)/))) {
                    tokens.push('<span class="yaml-anchor">' + match[1] + '</span>');
                    remaining = remaining.slice(match[1].length);
                }
                // Alias *name
                else if ((match = remaining.match(/^([*][a-zA-Z_][a-zA-Z0-9_-]*)/))) {
                    tokens.push('<span class="yaml-alias">' + match[1] + '</span>');
                    remaining = remaining.slice(match[1].length);
                }
                // Variable \${VAR}
                else if ((match = remaining.match(/^([$][{][A-Za-z_][A-Za-z0-9_]*[}])/))) {
                    tokens.push('<span class="yaml-variable">' + match[1] + '</span>');
                    remaining = remaining.slice(match[1].length);
                }
                // Variable $VAR
                else if ((match = remaining.match(/^([$][A-Za-z_][A-Za-z0-9_]*)/))) {
                    tokens.push('<span class="yaml-variable">' + match[1] + '</span>');
                    remaining = remaining.slice(match[1].length);
                }
                // Inline comment
                else if ((match = remaining.match(/^(\\s)(#.*)$/))) {
                    tokens.push(match[1] + '<span class="yaml-comment">' + match[2] + '</span>');
                    remaining = '';
                }
                // Plain character - consume one character at a time
                else {
                    tokens.push(remaining[0]);
                    remaining = remaining.slice(1);
                }
            }
            return tokens.join('');
        }

        function renderPipelineList(pipelines, status, structure, recentPipelineJobs) {
            var isRunning = status && status.running;
            pipelineRunning = isRunning;

            // Update navbar status
            updateNavbarStatus(isRunning);

            var actionBtn = '<span id="action-btn">' + (isRunning ?
                '<button class="btn btn-danger" onclick="handleCancelPipeline()">Cancel Pipeline</button>' :
                '<button class="btn btn-primary" onclick="handleRunPipeline()">&#9654; Run Pipeline</button>') + '</span>';

            // Get most recent pipeline ID for navigation
            var recentPipelineId = pipelines.length > 0 ? pipelines[0].id : null;

            // Build DAG visualization from YAML structure
            var dagSection = '';
            if (structure && structure.exists && structure.jobs && structure.jobs.length > 0) {
                var structureJobs = buildStructureJobs(structure, recentPipelineJobs);
                var dagHtml = renderDagVisualization(structureJobs, null, recentPipelineId);
                dagSection = '<div class="card"><div class="card-header"><h2>Pipeline Structure</h2>' + actionBtn + '</div><div class="card-body"><div id="dag-content">' + dagHtml + '</div></div></div>';
            } else {
                dagSection = '<div class="card"><div class="card-header"><h2>Pipeline Structure</h2>' + actionBtn + '</div>' +
                    '<div class="empty-state"><div class="empty-state-icon">📄</div><div>No .gitlab-ci.yml found</div>' +
                    '<div class="text-muted">Create a .gitlab-ci.yml file to get started</div></div></div>';
            }

            var pipelinesSection = '<div id="pipelines-section">' + renderPipelinesSection(pipelines) + '</div>';

            return dagSection + pipelinesSection;
        }

        function buildStructureJobs(structure, recentPipelineJobs) {
            var jobStatusMap = {};
            if (recentPipelineJobs && recentPipelineJobs.length > 0) {
                recentPipelineJobs.forEach(function(job) {
                    jobStatusMap[job.name] = {
                        status: job.status,
                        duration: job.duration,
                        id: job.id
                    };
                });
            }
            return structure.jobs.map(function(j) {
                var recentJob = jobStatusMap[j.name];
                return {
                    id: recentJob ? recentJob.id : j.id,
                    name: j.name,
                    stage: j.stage,
                    status: recentJob ? recentJob.status : 'pending',
                    needs: j.needs || null, // Already an array from API
                    duration: recentJob ? recentJob.duration : null
                };
            });
        }

        function renderPipelinesSection(pipelines) {
            if (!pipelines.length) {
                return '<div class="card"><div class="card-header"><h2>Recent Pipelines</h2></div>' +
                    '<div class="empty-state"><div class="empty-state-icon">&#128203;</div><div>No pipelines run yet</div>' +
                    '<div class="text-muted">Click "Run Pipeline" above to start</div></div></div>';
            }
            const rows = pipelines.map(p =>
                '<div class="pipeline-row" onclick="showPipeline(\\'' + p.id + '\\')">' +
                '<div class="pipeline-info"><span class="pipeline-id">#' + p.iid + '</span><span class="' + getStatusBadgeClass(p.status) + '">' + p.status + '</span><span class="pipeline-branch">' + (p.git_ref || '') + '</span></div>' +
                '<div class="pipeline-time">' + formatTime(p.created_at) + '</div></div>'
            ).join('');
            return '<div class="card"><div class="card-header"><h2>Recent Pipelines</h2></div><div class="card-body" style="padding:0">' + rows + '</div></div>';
        }

        function updatePipelineListContent(pipelines, status, structure, recentPipelineJobs) {
            var isRunning = status && status.running;
            pipelineRunning = isRunning;
            updateNavbarStatus(isRunning);

            // Update action button
            var actionBtnEl = document.getElementById('action-btn');
            if (actionBtnEl) {
                actionBtnEl.innerHTML = isRunning ?
                    '<button class="btn btn-danger" onclick="handleCancelPipeline()">Cancel Pipeline</button>' :
                    '<button class="btn btn-primary" onclick="handleRunPipeline()">&#9654; Run Pipeline</button>';
            }

            // Update DAG content - update statuses in place to avoid line flicker
            var dagContent = document.getElementById('dag-content');
            if (dagContent && structure && structure.exists && structure.jobs) {
                var recentPipelineId = pipelines.length > 0 ? pipelines[0].id : null;
                var structureJobs = buildStructureJobs(structure, recentPipelineJobs);
                var existingDagJobs = dagContent.querySelectorAll('.dag-job');

                if (existingDagJobs.length === structureJobs.length && existingDagJobs.length > 0) {
                    // Update statuses in place
                    structureJobs.forEach(function(job) {
                        var jobEl = dagContent.querySelector('.dag-job[data-job-name="' + escapeHtml(job.name) + '"]');
                        if (jobEl) {
                            jobEl.className = 'dag-job status-' + job.status;
                            // Update only the icon, preserve the tooltip
                            var iconEl = jobEl.querySelector('.dag-job-icon');
                            if (iconEl) {
                                iconEl.textContent = getStatusIcon(job.status);
                            }
                            // Update tooltip status info
                            var tooltipInfo = jobEl.querySelector('.dag-job-tooltip-info');
                            if (tooltipInfo) {
                                tooltipInfo.textContent = job.status + (job.duration ? ' • ' + formatDuration(job.duration) : '');
                            }
                        }
                    });
                } else {
                    // Structure changed, do full re-render
                    dagContent.innerHTML = renderDagVisualization(structureJobs, null, recentPipelineId);
                    scheduleDependencyLinesDraw();
                }
            }

            // Update pipelines section
            var pipelinesSection = document.getElementById('pipelines-section');
            if (pipelinesSection) {
                pipelinesSection.innerHTML = renderPipelinesSection(pipelines);
            }
        }

        function updateNavbarStatus(isRunning) {
            var navStatus = document.getElementById('nav-status');
            if (navStatus) {
                if (isRunning) {
                    navStatus.innerHTML = '<div class="status-dot running"></div><span>Running</span>';
                } else {
                    navStatus.innerHTML = '<div class="status-dot idle"></div><span>Ready</span>';
                }
            }
        }

        window.handleRunPipeline = async function() {
            try {
                var result = await runPipeline();
                if (result.success) {
                    pipelineRunning = true;
                    router(); // Refresh view
                } else {
                    alert('Failed to start pipeline: ' + (result.error || 'Unknown error'));
                }
            } catch (e) {
                alert('Error: ' + e.message);
            }
        };

        window.handleCancelPipeline = async function() {
            if (!confirm('Cancel the running pipeline?')) return;
            try {
                var result = await cancelPipeline();
                if (result.success) {
                    pipelineRunning = false;
                    router();
                }
            } catch (e) {
                alert('Error: ' + e.message);
            }
        };

        window.handleRunJob = async function(jobId, jobName) {
            // Immediately update UI to show running state
            var jobEl = document.querySelector('.dag-job[data-job-id="' + jobId + '"]');
            if (jobEl) {
                jobEl.className = jobEl.className.replace(/status-[a-zA-Z0-9_]+/, 'status-running');
                var iconEl = jobEl.querySelector('.dag-job-icon');
                if (iconEl) iconEl.textContent = '◉'; // Running icon
                var tooltipInfo = jobEl.querySelector('.dag-job-tooltip-info');
                if (tooltipInfo) tooltipInfo.textContent = 'running';
            }

            // Update the job header badge if logs panel is open
            var jobHeader = document.getElementById('job-header');
            if (jobHeader && selectedJobId === jobId) {
                jobHeader.innerHTML = escapeHtml(jobName) + ' <span class="badge badge-running">running</span>';
            }

            // Disable the run button
            var runBtn = document.getElementById('run-job-btn');
            if (runBtn) runBtn.disabled = true;

            try {
                // Run the single job directly (updates existing pipeline)
                var result = await runSingleJob(jobId);
                if (result.success) {
                    pipelineRunning = true;
                    // Don't call router() - let the refresh interval update the view
                } else {
                    alert('Failed to run job: ' + (result.error || 'Unknown error'));
                    router(); // Refresh to restore original state
                }
            } catch (e) {
                alert('Error: ' + e.message);
                router(); // Refresh to restore original state
            }
        };

        async function processJobQueue() {
            if (pipelineRunning || queuedJobs.length === 0) return;

            // Get all queued job names and clear the queue
            var jobsToRun = queuedJobs.map(function(j) { return j.name; });
            queuedJobs = [];

            try {
                // Run all queued jobs together using the pipeline endpoint with job names
                var result = await runPipeline(jobsToRun);
                if (result.success) {
                    pipelineRunning = true;
                    router(); // Refresh view
                } else {
                    alert('Failed to run jobs: ' + (result.error || 'Unknown error'));
                    router(); // Refresh to restore original state
                }
            } catch (e) {
                alert('Error: ' + e.message);
                router(); // Refresh to restore original state
            }
        }

        window.handleRunStage = async function(stageName) {
            // Collect all jobs in this stage and add them to the queue
            var allJobs = document.querySelectorAll('.dag-job');
            allJobs.forEach(function(jobEl) {
                // Find the stage this job belongs to by traversing up
                var stageEl = jobEl.closest('.dag-stage');
                if (stageEl) {
                    var stageHeader = stageEl.querySelector('.dag-stage-header span');
                    if (stageHeader && stageHeader.textContent.toLowerCase() === stageName.toLowerCase()) {
                        var jobName = jobEl.getAttribute('data-job-name');
                        var jobId = jobEl.getAttribute('data-job-id');

                        // Add to queue if not already queued
                        if (jobName && !queuedJobs.some(function(j) { return j.name === jobName; })) {
                            queuedJobs.push({ id: jobId, name: jobName });
                        }

                        // Update UI to queued state
                        jobEl.className = jobEl.className.replace(/status-[a-zA-Z0-9_]+/, 'status-pending');
                        var iconEl = jobEl.querySelector('.dag-job-icon');
                        if (iconEl) iconEl.textContent = '◎'; // Queued icon
                        var tooltipInfo = jobEl.querySelector('.dag-job-tooltip-info');
                        if (tooltipInfo) tooltipInfo.textContent = 'queued';
                    }
                }
            });

            // If not already running, process the queue after a short delay
            if (!pipelineRunning) {
                setTimeout(processJobQueue, 300);
            }
        };

        function getStatusIcon(status) {
            var icons = {
                success: '✓',
                failed: '✕',
                warning: '!',
                running: '◉',
                pending: '○'
            };
            return icons[status] || '○';
        }

        // ANSI color code parser
        function parseAnsiColors(text) {
            var colorMap = {
                '30': 'ansi-black', '31': 'ansi-red', '32': 'ansi-green', '33': 'ansi-yellow',
                '34': 'ansi-blue', '35': 'ansi-magenta', '36': 'ansi-cyan', '37': 'ansi-white',
                '90': 'ansi-bright-black', '91': 'ansi-bright-red', '92': 'ansi-bright-green', '93': 'ansi-bright-yellow',
                '94': 'ansi-bright-blue', '95': 'ansi-bright-magenta', '96': 'ansi-bright-cyan', '97': 'ansi-bright-white',
                '40': 'ansi-bg-black', '41': 'ansi-bg-red', '42': 'ansi-bg-green', '43': 'ansi-bg-yellow',
                '44': 'ansi-bg-blue', '45': 'ansi-bg-magenta', '46': 'ansi-bg-cyan', '47': 'ansi-bg-white',
                '1': 'ansi-bold', '2': 'ansi-dim', '3': 'ansi-italic', '4': 'ansi-underline'
            };
            var result = '';
            var activeClasses = [];
            // Match ANSI escape sequences
            var regex = /\\x1b\\[([0-9;]*)m|\\u001b\\[([0-9;]*)m|\\033\\[([0-9;]*)m/g;
            var lastIndex = 0;
            var match;
            var escaped = escapeHtml(text.replace(/\\x1b\\[|\\u001b\\[|\\033\\[/g, '\\x1b['));
            // Re-process with escaped text
            var parts = escaped.split(/(\\x1b\\[[0-9;]*m)/g);
            parts.forEach(function(part) {
                if (part.match(/^\\x1b\\[([0-9;]*)m$/)) {
                    var codes = part.replace(/\\x1b\\[|m$/g, '').split(';');
                    codes.forEach(function(code) {
                        if (code === '0' || code === '') {
                            activeClasses = [];
                        } else if (colorMap[code]) {
                            activeClasses.push(colorMap[code]);
                        }
                    });
                } else if (part) {
                    if (activeClasses.length > 0) {
                        result += '<span class="' + activeClasses.join(' ') + '">' + part + '</span>';
                    } else {
                        result += part;
                    }
                }
            });
            return result || escapeHtml(text);
        }

        var selectedJobId = null;
        var logAutoScroll = true;
        var renderedLogCount = 0;
        var logRefreshInterval = null;

        function renderDagVisualization(jobs, selectedId, pipelineId) {
            // Group jobs by stage
            var stageMap = {};
            var stageOrder = [];
            jobs.forEach(function(j) {
                if (!stageMap[j.stage]) {
                    stageMap[j.stage] = [];
                    stageOrder.push(j.stage);
                }
                stageMap[j.stage].push(j);
            });

            // Build DAG stages HTML with circles
            var stagesHtml = stageOrder.map(function(stage) {
                var stageJobs = stageMap[stage];
                var jobsHtml = stageJobs.map(function(j) {
                    // needs is already parsed as array from API
                    var needs = j.needs || [];
                    var needsInfo = needs.length > 0 ? 'Needs: ' + needs.join(', ') : '';
                    var selectedClass = selectedId === j.id ? ' selected' : '';
                    var icon = getStatusIcon(j.status);
                    // If pipelineId is provided, clicking navigates to pipeline detail; otherwise, selects job
                    var clickHandler = pipelineId ?
                        'location.hash=\\'#/pipeline/' + pipelineId + '\\'; setTimeout(function() { selectJob(\\'' + j.id + '\\'); }, 100);' :
                        'selectJob(\\'' + j.id + '\\')';
                    return '<div class="dag-job status-' + j.status + selectedClass + '" data-job-id="' + j.id + '" data-job-name="' + escapeHtml(j.name) + '" data-needs="' + escapeHtml(needs.join(',')) + '" onclick="' + clickHandler + '">' +
                        '<span class="dag-job-icon">' + icon + '</span>' +
                        '<div class="dag-job-tooltip">' +
                        '<div class="dag-job-tooltip-name">' + escapeHtml(j.name) + '</div>' +
                        '<div class="dag-job-tooltip-info">' + j.status + (j.duration ? ' • ' + formatDuration(j.duration) : '') + '</div>' +
                        (needsInfo ? '<div class="dag-job-tooltip-info">' + needsInfo + '</div>' : '') +
                        '</div></div>';
                }).join('');
                return '<div class="dag-stage"><div class="dag-stage-header"><span>' + escapeHtml(stage) + '</span><button class="run-stage-btn" onclick="event.stopPropagation(); handleRunStage(\\'' + escapeHtml(stage) + '\\')" title="Run stage">▶</button></div><div class="dag-jobs">' + jobsHtml + '</div></div>';
            }).join('');

            var legend = '<div class="dag-legend">' +
                '<div class="dag-legend-item"><div class="dag-legend-color" style="border:none;background:var(--text-muted)"></div>Pending</div>' +
                '<div class="dag-legend-item"><div class="dag-legend-color" style="border:none;background:var(--accent-color)"></div>Running</div>' +
                '<div class="dag-legend-item"><div class="dag-legend-color" style="border:none;background:var(--success-color)"></div>Success</div>' +
                '<div class="dag-legend-item"><div class="dag-legend-color" style="border:none;background:var(--error-color)"></div>Failed</div>' +
                '</div>';

            return legend + '<div class="dag-container"><svg class="dag-lines"></svg><div class="dag-stages">' + stagesHtml + '</div></div>';
        }

        function drawDependencyLines() {
            var svg = document.querySelector('.dag-lines');
            if (!svg) return;

            // Clear existing lines
            svg.innerHTML = '';

            // Add arrowhead marker definition
            var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            defs.innerHTML = '<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">' +
                '<polygon points="0 0, 10 3.5, 0 7" fill="var(--border-color)" opacity="0.6"/></marker>' +
                '<marker id="arrowhead-accent" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">' +
                '<polygon points="0 0, 10 3.5, 0 7" fill="var(--accent-color)" opacity="0.8"/></marker>';
            svg.appendChild(defs);

            var container = svg.closest('.dag-container');
            if (!container) return;

            var containerRect = container.getBoundingClientRect();

            // Find all jobs with needs
            var jobs = container.querySelectorAll('.dag-job');
            var jobsByName = {};
            jobs.forEach(function(job) {
                var name = job.getAttribute('data-job-name');
                if (name) {
                    jobsByName[name] = job;
                }
            });

            // Draw lines for each job that has needs
            jobs.forEach(function(job) {
                var needsAttr = job.getAttribute('data-needs');
                if (!needsAttr) return;

                var needs = needsAttr.split(',').filter(function(n) { return n.trim(); });
                needs.forEach(function(needName) {
                    var sourceJob = jobsByName[needName.trim()];
                    if (!sourceJob) return;

                    var sourceRect = sourceJob.getBoundingClientRect();
                    var targetRect = job.getBoundingClientRect();

                    // Check if jobs are in the same stage (same column - similar x position)
                    var sameStage = Math.abs(sourceRect.left - targetRect.left) < 50;

                    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

                    if (sameStage) {
                        // Same stage: draw vertical line from source bottom to target top
                        var x1 = sourceRect.left + sourceRect.width / 2 - containerRect.left;
                        var y1 = sourceRect.bottom - containerRect.top;
                        var x2 = targetRect.left + targetRect.width / 2 - containerRect.left;
                        var y2 = targetRect.top - containerRect.top;

                        // If target is above source, flip direction
                        if (y2 < y1) {
                            var temp = y1; y1 = y2; y2 = temp;
                            var tempX = x1; x1 = x2; x2 = tempX;
                            y1 = sourceRect.top - containerRect.top;
                            y2 = targetRect.bottom - containerRect.top;
                        }

                        // Curved vertical path
                        var midY = (y1 + y2) / 2;
                        path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + midY + ', ' + x2 + ' ' + midY + ', ' + x2 + ' ' + y2);
                        path.setAttribute('class', 'dag-line dag-line-same-stage');
                        path.style.markerEnd = 'url(#arrowhead-accent)';
                    } else {
                        // Different stages: draw horizontal curved line
                        var x1 = sourceRect.right - containerRect.left;
                        var y1 = sourceRect.top + sourceRect.height / 2 - containerRect.top;
                        var x2 = targetRect.left - containerRect.left;
                        var y2 = targetRect.top + targetRect.height / 2 - containerRect.top;

                        // Create curved path
                        var midX = (x1 + x2) / 2;
                        path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' C ' + midX + ' ' + y1 + ', ' + midX + ' ' + y2 + ', ' + x2 + ' ' + y2);
                        path.setAttribute('class', 'dag-line');
                    }
                    svg.appendChild(path);
                });
            });
        }

        // Draw lines after DOM updates
        function scheduleDependencyLinesDraw() {
            requestAnimationFrame(function() {
                setTimeout(drawDependencyLines, 50);
            });
        }

        function renderInitProgress(p) {
            if (!p.init_phase || p.status === 'running' || p.status === 'success' || p.status === 'failed') {
                return '';
            }
            var progress = p.init_progress || 0;
            var message = p.init_message || 'Initializing...';
            return '<div class="init-progress" id="init-progress">' +
                '<div class="init-progress-header">' +
                '<span class="init-progress-label"><span class="init-spinner"></span> ' + escapeHtml(message) + '</span>' +
                '<span class="init-progress-phase">' + progress + '%</span>' +
                '</div>' +
                '<div class="init-progress-bar"><div class="init-progress-fill" style="width: ' + progress + '%"></div></div>' +
                '</div>';
        }

        function renderPipelineDetail(data, selectedJob, logData) {
            const p = data.pipeline;
            const jobs = data.jobs || [];
            const dagHtml = renderDagVisualization(jobs, selectedJobId);
            const initProgressHtml = renderInitProgress(p);

            var leftPanelClass = selectedJob ? 'split-left' : 'split-left full-width';
            var leftPanel = '<div class="' + leftPanelClass + '">' +
                '<a href="#/" class="back-link">&larr; Back to pipelines</a>' +
                '<div class="card"><div class="card-header"><div><h2>Pipeline #' + p.iid + '</h2></div><span id="pipeline-status" class="' + getStatusBadgeClass(p.status) + '">' + p.status + '</span></div>' +
                '<div class="card-body"><p>Started: ' + formatTime(p.started_at) + '</p><p id="pipeline-duration">Duration: ' + formatDuration(p.duration) + '</p>' + initProgressHtml + '</div></div>' +
                '<div class="card"><div class="card-header"><h2>Pipeline Graph</h2><span class="text-muted">Click a job to view logs</span></div><div class="card-body"><div id="pipeline-dag">' + dagHtml + '</div></div></div>' +
                '</div>';

            // If a job is selected, show split view with logs
            if (selectedJob && logData) {
                var logs = logData.logs || [];
                var totalLogs = logData.total || logs.length;
                var reachedLimit = logs.length < totalLogs;
                var logCountText = logs.length + ' lines' + (reachedLimit ? ' (reached limit of ' + logs.length + ', total: ' + totalLogs + ')' : '');
                var logLines = logs.map(function(l, i) {
                    return '<div class="live-log-line"><span class="live-log-line-number">' + (i + 1) + '</span><span class="live-log-content">' + parseAnsiColors(l.content) + '</span></div>';
                }).join('');

                var autoScrollClass = logAutoScroll ? ' active' : '';
                var runBtnText = (selectedJob.status === 'pending' || selectedJob.status === 'running') ? 'Run' : 'Retry';
                var runBtnDisabled = pipelineRunning ? ' disabled' : '';
                var rightPanel = '<div class="split-right">' +
                    '<div class="split-right-header">' +
                    '<h3 id="job-header">' + escapeHtml(selectedJob.name) + ' <span class="' + getStatusBadgeClass(selectedJob.status) + '">' + selectedJob.status + '</span></h3>' +
                    '<div class="header-actions">' +
                    '<button class="run-job-btn" id="run-job-btn" onclick="handleRunJob(\\''+selectedJob.id+'\\', \\''+escapeHtml(selectedJob.name)+'\\')"'+runBtnDisabled+'>' + runBtnText + '</button>' +
                    '<button class="run-job-btn" style="background:var(--border-color);color:white" onclick="window.open(\\'/api/jobs/' + selectedJob.id + '/logs/raw\\', \\'_blank\\')">Raw</button>' +
                    '<button class="close-btn" onclick="closeLogPanel()">×</button>' +
                    '</div>' +
                    '</div>' +
                    '<div class="split-right-body">' +
                    '<div class="live-log-viewer" id="live-log-viewer" onscroll="handleLogScroll()">' + (logLines || '<div class="text-muted" style="padding:1rem">No logs yet</div>') + '</div>' +
                    '</div>' +
                    '<div class="log-status-bar">' +
                    '<span id="log-count">' + logCountText + '</span>' +
                    '<div class="auto-scroll-indicator' + autoScrollClass + '">' +
                    '<span>' + (logAutoScroll ? '● Auto-scroll ON' : '○ Auto-scroll OFF') + '</span>' +
                    '</div>' +
                    '</div>' +
                    '</div>';

                // Add full-width class to container when showing logs
                setTimeout(function() {
                    var container = document.querySelector('.app-main .container');
                    if (container) container.classList.add('full-width');
                    initSplitDivider();
                }, 0);
                return '<div class="split-view">' + leftPanel + '<div class="split-divider" id="split-divider"></div>' + rightPanel + '</div>';
            }

            // No job selected - show just the pipeline graph (full width)
            setTimeout(function() {
                var container = document.querySelector('.app-main .container');
                if (container) container.classList.remove('full-width');
            }, 0);
            return '<div class="split-view">' + leftPanel + '</div>';
        }

        function renderLogLines(logs) {
            return logs.map(function(l, i) {
                return '<div class="live-log-line"><span class="live-log-line-number">' + (i + 1) + '</span><span class="live-log-content">' + parseAnsiColors(l.content) + '</span></div>';
            }).join('');
        }

        window.selectJob = async function(jobId) {
            selectedJobId = jobId;
            logAutoScroll = true;
            renderedLogCount = 0;

            // Start live log refresh
            if (logRefreshInterval) {
                clearInterval(logRefreshInterval);
            }

            // Initial render
            await refreshPipelineView();

            // Set up live log polling
            logRefreshInterval = setInterval(async function() {
                if (selectedJobId) {
                    await refreshPipelineView();
                    // Auto-scroll to bottom if enabled
                    if (logAutoScroll) {
                        var viewer = document.getElementById('live-log-viewer');
                        if (viewer) {
                            viewer.scrollTop = viewer.scrollHeight;
                        }
                    }
                }
            }, 1000);
        };

        window.closeLogPanel = function() {
            selectedJobId = null;
            renderedLogCount = 0;
            if (logRefreshInterval) {
                clearInterval(logRefreshInterval);
                logRefreshInterval = null;
            }
            refreshPipelineView();
        };

        window.handleLogScroll = function() {
            var viewer = document.getElementById('live-log-viewer');
            if (viewer) {
                // Check if user scrolled away from bottom
                var atBottom = viewer.scrollHeight - viewer.scrollTop - viewer.clientHeight < 50;
                logAutoScroll = atBottom;
            }
        };

        // Initialize the split divider for dragging
        function initSplitDivider() {
            var divider = document.getElementById('split-divider');
            var splitView = document.querySelector('.split-view');
            var leftPanel = document.querySelector('.split-left');
            if (!divider || !splitView || !leftPanel) return;

            var isDragging = false;
            var startX = 0;
            var startWidth = 0;

            divider.addEventListener('mousedown', function(e) {
                isDragging = true;
                startX = e.clientX;
                startWidth = leftPanel.offsetWidth;
                divider.classList.add('dragging');
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
                e.preventDefault();
            });

            document.addEventListener('mousemove', function(e) {
                if (!isDragging) return;
                var delta = e.clientX - startX;
                var newWidth = startWidth + delta;
                var minWidth = 200;
                var maxWidth = splitView.offsetWidth - 200 - 6; // 6px divider
                newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
                leftPanel.style.flex = '0 0 ' + newWidth + 'px';
            });

            document.addEventListener('mouseup', function() {
                if (!isDragging) return;
                isDragging = false;
                divider.classList.remove('dragging');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            });
        }

        async function refreshPipelineView() {
            var hash = location.hash.slice(1);
            if (!hash.startsWith('/pipeline/')) return;

            var pipelineId = hash.split('/')[2];
            var [data, status] = await Promise.all([fetchPipeline(pipelineId), fetchPipelineStatus()]);
            pipelineRunning = status && status.running;
            var p = data.pipeline;
            var jobs = data.jobs || [];

            // Check if we need a full render (structure changed)
            var logPanelExists = document.getElementById('live-log-viewer') !== null;
            var needsLogPanel = selectedJobId !== null;

            // If structure needs to change, do full render
            if (needsLogPanel !== logPanelExists) {
                var selectedJob = null;
                var logData = null;
                if (selectedJobId) {
                    selectedJob = jobs.find(function(j) { return j.id === selectedJobId; });
                    if (selectedJob) {
                        logData = await fetchJobLogs(selectedJobId);
                    }
                }
                var root = document.getElementById('app-root');
                root.innerHTML = renderPipelineDetail(data, selectedJob, logData);
                // Update renderedLogCount after full render
                renderedLogCount = logData && logData.logs ? logData.logs.length : 0;
                scheduleDependencyLinesDraw();
                if (logAutoScroll && selectedJobId) {
                    var viewer = document.getElementById('live-log-viewer');
                    if (viewer) viewer.scrollTop = viewer.scrollHeight;
                }
                return;
            }

            // Targeted updates - structure unchanged
            var pipelineStatus = document.getElementById('pipeline-status');
            if (pipelineStatus) {
                pipelineStatus.className = getStatusBadgeClass(p.status);
                pipelineStatus.textContent = p.status;
            }
            var pipelineDuration = document.getElementById('pipeline-duration');
            if (pipelineDuration) {
                pipelineDuration.textContent = 'Duration: ' + formatDuration(p.duration);
            }

            // Update or remove init progress section
            var initProgressEl = document.getElementById('init-progress');
            if (initProgressEl) {
                // Remove init progress if pipeline is now running/success/failed
                if (p.status === 'running' || p.status === 'success' || p.status === 'failed') {
                    initProgressEl.remove();
                } else if (p.init_phase) {
                    // Update progress values
                    var progressFill = initProgressEl.querySelector('.init-progress-fill');
                    var progressPhase = initProgressEl.querySelector('.init-progress-phase');
                    var progressLabel = initProgressEl.querySelector('.init-progress-label');
                    if (progressFill) progressFill.style.width = (p.init_progress || 0) + '%';
                    if (progressPhase) progressPhase.textContent = (p.init_progress || 0) + '%';
                    if (progressLabel) progressLabel.innerHTML = '<span class="init-spinner"></span> ' + escapeHtml(p.init_message || 'Initializing...');
                }
            }

            // Update DAG job statuses in place (avoid full re-render to prevent line flicker)
            var pipelineDag = document.getElementById('pipeline-dag');
            if (pipelineDag) {
                var dagJobs = pipelineDag.querySelectorAll('.dag-job');
                var jobsChanged = dagJobs.length !== jobs.length;

                if (!jobsChanged) {
                    // Update statuses in place
                    jobs.forEach(function(job) {
                        var jobEl = pipelineDag.querySelector('.dag-job[data-job-id="' + job.id + '"]');
                        if (jobEl) {
                            // Update status class
                            jobEl.className = 'dag-job status-' + job.status + (job.id === selectedJobId ? ' selected' : '');
                            // Update only the icon, preserve the tooltip
                            var iconEl = jobEl.querySelector('.dag-job-icon');
                            if (iconEl) {
                                iconEl.textContent = getStatusIcon(job.status);
                            }
                            // Update tooltip status info
                            var tooltipInfo = jobEl.querySelector('.dag-job-tooltip-info');
                            if (tooltipInfo) {
                                tooltipInfo.textContent = job.status + (job.duration ? ' • ' + formatDuration(job.duration) : '');
                            }
                        }
                    });
                } else {
                    // Jobs changed, do full re-render
                    pipelineDag.innerHTML = renderDagVisualization(jobs, selectedJobId);
                    scheduleDependencyLinesDraw();
                }
            }

            // Update logs if a job is selected
            if (selectedJobId) {
                var selectedJob = jobs.find(function(j) { return j.id === selectedJobId; });
                if (selectedJob) {
                    var logData = await fetchJobLogs(selectedJobId);
                    var logs = logData.logs || [];

                    // Check if user has text selected - skip updates that might reset selection
                    var selection = window.getSelection();
                    var hasSelection = selection && selection.toString().length > 0;

                    // Update job header (only if no selection to preserve focus)
                    if (!hasSelection) {
                        var jobHeader = document.getElementById('job-header');
                        if (jobHeader) {
                            jobHeader.innerHTML = escapeHtml(selectedJob.name) + ' <span class="' + getStatusBadgeClass(selectedJob.status) + '">' + selectedJob.status + '</span>';
                        }
                    }

                    // Update run button disabled state
                    var runBtn = document.getElementById('run-job-btn');
                    if (runBtn) {
                        runBtn.disabled = pipelineRunning;
                    }

                    // Update log content - only append new lines to preserve text selection
                    var viewer = document.getElementById('live-log-viewer');
                    if (viewer) {
                        var wasAtBottom = viewer.scrollHeight - viewer.scrollTop - viewer.clientHeight < 50;

                        if (!hasSelection) {
                            if (renderedLogCount === 0) {
                                // Fresh job selection - render all logs or empty message
                                if (logs.length > 0) {
                                    var allHtml = logs.map(function(l, i) {
                                        return '<div class="live-log-line"><span class="live-log-line-number">' + (i + 1) + '</span><span class="live-log-content">' + parseAnsiColors(l.content) + '</span></div>';
                                    }).join('');
                                    viewer.innerHTML = allHtml;
                                } else {
                                    viewer.innerHTML = '<div class="text-muted" style="padding:1rem">No logs yet</div>';
                                }
                                renderedLogCount = logs.length;
                            } else if (logs.length > renderedLogCount) {
                                // Append only new log lines
                                var newLogs = logs.slice(renderedLogCount);
                                var newHtml = newLogs.map(function(l, i) {
                                    var lineNum = renderedLogCount + i + 1;
                                    return '<div class="live-log-line"><span class="live-log-line-number">' + lineNum + '</span><span class="live-log-content">' + parseAnsiColors(l.content) + '</span></div>';
                                }).join('');
                                viewer.insertAdjacentHTML('beforeend', newHtml);
                                renderedLogCount = logs.length;
                            }
                        }

                        // Auto-scroll only if was at bottom and no selection
                        if (logAutoScroll && wasAtBottom && !hasSelection) {
                            viewer.scrollTop = viewer.scrollHeight;
                        }
                    }

                    // Update log count (only if no selection)
                    if (!hasSelection) {
                        var logCount = document.getElementById('log-count');
                        if (logCount) {
                            var totalLogs = logData.total || logs.length;
                            var reachedLimit = logs.length < totalLogs;
                            logCount.textContent = logs.length + ' lines' + (reachedLimit ? ' (reached limit of ' + logs.length + ', total: ' + totalLogs + ')' : '');
                        }
                    }
                }
            }
        }

        function formatBytes(bytes) {
            if (!bytes || bytes === 0) return '0 B';
            var k = 1024;
            var sizes = ['B', 'KB', 'MB', 'GB'];
            var i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }

        function renderArtifacts(artifacts, jobId) {
            if (!artifacts || artifacts.length === 0) {
                return '<div class="text-muted">No artifacts</div>';
            }
            var items = artifacts.map(function(a) {
                return '<div class="artifact-item">' +
                    '<div class="artifact-info">' +
                    '<span class="artifact-icon">&#128196;</span>' +
                    '<span class="artifact-name">' + escapeHtml(a.file_path) + '</span>' +
                    '</div>' +
                    '<div>' +
                    '<span class="artifact-size">' + formatBytes(a.size) + '</span>' +
                    ' <a href="/api/jobs/' + jobId + '/artifacts/' + encodeURIComponent(a.file_path) + '" class="artifact-download" download>Download</a>' +
                    '</div>' +
                    '</div>';
            }).join('');
            return '<div class="artifact-list">' + items + '</div>';
        }

        function renderJobLogs(data, jobId, runStatus) {
            var logs = data.logs || [];
            var artifacts = data.artifacts || [];
            var job = data.job || {};
            var isRunning = runStatus && runStatus.running;
            var lines = logs.map(function(l,i) {
                return '<div class="log-line"><span class="log-line-number">' + (i+1) + '</span><span>' + escapeHtml(l.content) + '</span></div>';
            }).join('');

            var runBtn = isRunning ?
                '<button class="btn btn-secondary btn-sm" disabled>Running...</button>' :
                '<button class="btn btn-success btn-sm" onclick="handleRunJobLegacy(\\'' + jobId + '\\')">&#9654; Run Job</button>';

            var jobInfo = job.name ? '<p><strong>Job:</strong> ' + escapeHtml(job.name) + '</p>' +
                '<p><strong>Stage:</strong> ' + escapeHtml(job.stage || 'unknown') + '</p>' +
                '<p><strong>Status:</strong> <span class="' + getStatusBadgeClass(job.status) + '">' + (job.status || 'unknown') + '</span></p>' +
                (job.duration ? '<p><strong>Duration:</strong> ' + formatDuration(job.duration) + '</p>' : '') : '';

            var artifactsSection = artifacts.length > 0 ?
                '<div class="card"><div class="card-header"><h2>Artifacts</h2><span class="text-muted">' + artifacts.length + ' files</span></div>' +
                '<div class="card-body">' + renderArtifacts(artifacts, jobId) + '</div></div>' : '';

            return '<a href="javascript:history.back()" class="back-link">&larr; Back</a>' +
                (jobInfo ? '<div class="card"><div class="card-header"><div class="flex-between" style="width:100%"><h2>Job Details</h2>' + runBtn + '</div></div><div class="card-body">' + jobInfo + '</div></div>' : '') +
                artifactsSection +
                '<div class="card"><div class="card-header"><h2>Job Logs</h2><span class="text-muted">' + logs.length + ' lines</span></div>' +
                '<div class="card-body"><div class="log-viewer">' + (lines || '<div class="text-muted">No logs</div>') + '</div></div></div>';
        }

        window.handleRunJobLegacy = async function(jobId) {
            try {
                var result = await runSingleJob(jobId);
                if (result.success) {
                    alert('Job started: ' + result.job);
                    router(); // Refresh view
                } else {
                    alert('Failed to start job: ' + (result.error || 'Unknown error'));
                }
            } catch (e) {
                alert('Error: ' + e.message);
            }
        };

        // State for YAML view toggle
        var yamlViewMode = 'source'; // 'source' or 'rendered'
        var cachedSourceYaml = null;
        var cachedExpandedYaml = null;
        var cachedConfig = null;

        window.toggleYamlView = function(mode) {
            yamlViewMode = mode;
            updateYamlView();
        };

        function updateYamlView() {
            var sourceBtn = document.getElementById('yaml-source-btn');
            var renderedBtn = document.getElementById('yaml-rendered-btn');
            var yamlViewer = document.querySelector('.yaml-viewer');
            var lineCountSpan = document.getElementById('yaml-line-count');
            var titleSpan = document.getElementById('yaml-title');

            if (sourceBtn) sourceBtn.className = 'btn' + (yamlViewMode === 'source' ? ' active' : '');
            if (renderedBtn) renderedBtn.className = 'btn' + (yamlViewMode === 'rendered' ? ' active' : '');

            var data = yamlViewMode === 'source' ? cachedSourceYaml : cachedExpandedYaml;
            if (yamlViewer && data) {
                if (data.exists && data.content) {
                    yamlViewer.innerHTML = highlightYaml(data.content);
                    if (lineCountSpan) lineCountSpan.textContent = data.content.split('\\n').length + ' lines';
                    if (titleSpan) titleSpan.textContent = yamlViewMode === 'source' ? '.gitlab-ci.yml' : 'expanded-gitlab-ci.yml';
                } else {
                    yamlViewer.innerHTML = '<div class="text-muted" style="padding:1rem">' + (data.error || 'Not available') + '</div>';
                    if (lineCountSpan) lineCountSpan.textContent = '';
                }
            }
        }

        function renderYaml(data, expandedData, config) {
            cachedSourceYaml = data;
            cachedExpandedYaml = expandedData;
            cachedConfig = config;

            if (!data.exists) {
                return '<div class="card"><div class="empty-state"><div class="empty-state-icon">📄</div><div>No .gitlab-ci.yml found</div><div class="text-muted">Create a .gitlab-ci.yml file in the project root</div></div></div>';
            }

            var displayData = yamlViewMode === 'source' ? data : (expandedData.exists ? expandedData : data);
            var highlighted = highlightYaml(displayData.content || '');
            var lineCount = (displayData.content || '').split('\\n').length;
            var title = yamlViewMode === 'source' ? '.gitlab-ci.yml' : 'expanded-gitlab-ci.yml';

            var sourceActive = yamlViewMode === 'source' ? ' active' : '';
            var renderedActive = yamlViewMode === 'rendered' ? ' active' : '';
            var renderedDisabled = !expandedData.exists ? ' disabled title="Run a pipeline first to generate expanded YAML"' : '';

            return '<div class="card"><div class="card-header"><div><h2 id="yaml-title">' + title + '</h2><div class="cwd-info">' + escapeHtml(config.cwd) + '</div></div>' +
                '<div class="action-bar">' +
                '<div class="btn-group">' +
                '<button id="yaml-source-btn" class="btn' + sourceActive + '" onclick="toggleYamlView(\\'source\\')">Source</button>' +
                '<button id="yaml-rendered-btn" class="btn' + renderedActive + '"' + renderedDisabled + ' onclick="toggleYamlView(\\'rendered\\')">Rendered</button>' +
                '</div>' +
                '<span id="yaml-line-count" class="text-muted">' + lineCount + ' lines</span>' +
                '</div></div>' +
                '<div class="card-body" style="padding:0"><div class="yaml-viewer">' + highlighted + '</div></div></div>';
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function updateNav(hash) {
            document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
            if (hash === '/yaml') {
                document.getElementById('nav-yaml').classList.add('active');
            } else {
                document.getElementById('nav-pipelines').classList.add('active');
            }
        }

        window.showPipeline = async function(id) { location.hash = '/pipeline/' + id; };
        window.showJobLogs = async function(id) { location.hash = '/job/' + id + '/logs'; };

        let refreshInterval = null;

        async function router() {
            const root = document.getElementById('app-root');
            const hash = location.hash.slice(1) || '/';
            updateNav(hash);
            root.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

            // Reset container width for non-split-view pages
            var container = document.querySelector('.app-main .container');
            if (container && !hash.startsWith('/pipeline/')) {
                container.classList.remove('full-width');
            }

            // Clear auto-refresh for non-pipeline pages
            if (refreshInterval) {
                clearInterval(refreshInterval);
                refreshInterval = null;
            }

            try {
                if (hash === '/yaml') {
                    const [data, expandedData, config] = await Promise.all([fetchYaml(), fetchExpandedYaml(), fetchConfig()]);
                    root.innerHTML = renderYaml(data, expandedData, config);
                    // No auto-refresh for YAML view - content is static
                } else if (hash.startsWith('/pipeline/')) {
                    const id = hash.split('/')[2];
                    // Clear selected job when navigating to new pipeline
                    if (logRefreshInterval) {
                        clearInterval(logRefreshInterval);
                        logRefreshInterval = null;
                    }
                    selectedJobId = null;
                    const data = await fetchPipeline(id);
                    root.innerHTML = renderPipelineDetail(data, null, null);
                    scheduleDependencyLinesDraw();
                    // Auto-refresh pipeline view to show job updates
                    refreshInterval = setInterval(async () => {
                        try {
                            if (!selectedJobId && location.hash.slice(1).startsWith('/pipeline/')) {
                                await refreshPipelineView();
                            }
                        } catch (e) {}
                    }, 2000);
                } else if (hash.startsWith('/job/') && hash.endsWith('/logs')) {
                    const id = hash.split('/')[2];
                    const [logsData, artifactsData, jobData, runStatus] = await Promise.all([
                        fetchJobLogs(id),
                        fetchJobArtifacts(id),
                        fetchJob(id),
                        fetchPipelineStatus()
                    ]);
                    const combined = {
                        logs: logsData.logs,
                        artifacts: artifactsData.artifacts,
                        job: jobData.job
                    };
                    root.innerHTML = renderJobLogs(combined, id, runStatus);
                } else {
                    const [pipelines, status, structure] = await Promise.all([fetchPipelines(), fetchPipelineStatus(), fetchPipelineStructure()]);
                    // Fetch most recent pipeline's jobs if available
                    var recentJobs = [];
                    if (pipelines.length > 0) {
                        try {
                            var recentPipeline = await fetchPipeline(pipelines[0].id);
                            recentJobs = recentPipeline.jobs || [];
                        } catch (e) {}
                    }
                    root.innerHTML = renderPipelineList(pipelines, status, structure, recentJobs);
                    scheduleDependencyLinesDraw();
                    // Auto-refresh pipeline list - only update content fields
                    refreshInterval = setInterval(async () => {
                        try {
                            const [newPipelines, newStatus, newStructure] = await Promise.all([fetchPipelines(), fetchPipelineStatus(), fetchPipelineStructure()]);
                            // Fetch most recent pipeline's jobs
                            var newRecentJobs = [];
                            if (newPipelines.length > 0) {
                                try {
                                    var recentPipeline = await fetchPipeline(newPipelines[0].id);
                                    newRecentJobs = recentPipeline.jobs || [];
                                } catch (e) {}
                            }
                            if (location.hash.slice(1) === '/' || location.hash === '') {
                                updatePipelineListContent(newPipelines, newStatus, newStructure, newRecentJobs);
                            }
                        } catch (e) {}
                    }, 2000);
                }
            } catch (e) {
                root.innerHTML = '<div class="card"><div class="empty-state"><div class="empty-state-icon">&#9888;</div><div>Error loading data</div><div class="text-muted">' + e.message + '</div></div></div>';
            }
        }

        window.addEventListener('hashchange', router);
        router();
    </script>
</body>
</html>`;
