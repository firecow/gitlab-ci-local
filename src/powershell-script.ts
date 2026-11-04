import {execa} from "execa";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";

// Same probe GitLab Runner emits after each command. $ErrorActionPreference does not stop native programs.
const POWERSHELL_STATUS_CHECK = "if(!$?) { Exit &{if($LASTEXITCODE) {$LASTEXITCODE} else {1}} }";

// Ask powershell.exe/pwsh for statement end offsets. Splitting on physical lines is not safe:
// a check inserted after every line lands inside if/else, try/catch, pipelines, and here-strings.
const POWERSHELL_STATEMENT_PROBE = String.raw`
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$path = $env:GCL_PS_PARSE_FILE
if ([string]::IsNullOrEmpty($path)) { exit 2 }
$json = [System.IO.File]::ReadAllText($path, (New-Object System.Text.UTF8Encoding $false))
$scripts = $json | ConvertFrom-Json
if ($null -eq $scripts) { exit 0 }
if ($scripts -is [string]) { $scripts = @($scripts) }

function Emit-BlockStatements($block, $seen) {
    if ($null -eq $block) { return }
    foreach ($stmt in @($block.Statements)) {
        if ($null -eq $stmt) { continue }
        $off = [int]$stmt.Extent.EndOffset
        $key = [string]$off
        if ($seen.ContainsKey($key)) { continue }
        $seen[$key] = $true
        Write-Output $off
    }
}

for ($i = 0; $i -lt $scripts.Count; $i++) {
    Write-Output "SCRIPT $i"
    $raw = [string]$scripts[$i]
    $parseErrors = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseInput($raw, [ref]$null, [ref]$parseErrors)
    if ($null -ne $parseErrors -and @($parseErrors).Count -gt 0) {
        Write-Output 'PARSE_ERROR'
        continue
    }
    $seen = @{}
    $scriptBlocks = @($ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.ScriptBlockAst] }, $true))
    foreach ($sb in $scriptBlocks) {
        Emit-BlockStatements $sb.BeginBlock $seen
        Emit-BlockStatements $sb.ProcessBlock $seen
        Emit-BlockStatements $sb.EndBlock $seen
        Emit-BlockStatements $sb.DynamicParamBlock $seen
    }
    $statementBlocks = @($ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.StatementBlockAst] }, $true))
    foreach ($block in $statementBlocks) {
        Emit-BlockStatements $block $seen
    }
}
`;

function applyStatusChecks (script: string, offsets: number[]): string {
    const unique = [...new Set(offsets.filter((offset) => offset >= 0 && offset <= script.length))];
    unique.sort((a, b) => b - a);
    let result = script;
    for (const offset of unique) {
        result = `${result.slice(0, offset)}\n${POWERSHELL_STATUS_CHECK}\n${result.slice(offset)}`;
    }
    return result;
}

// null means the probe process failed and the caller should append one check after the intact script.
function parseProbeOutput (stdout: string, scriptCount: number): Array<number[] | null> | null {
    const offsets: Array<number[] | null> = Array.from({length: scriptCount}, () => []);
    const seen = new Set<number>();
    let index = -1;

    for (const line of stdout.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed === "") continue;

        const marker = /^SCRIPT (\d+)$/.exec(trimmed);
        if (marker) {
            index = Number(marker[1]);
            if (index >= scriptCount) return null;
            seen.add(index);
            continue;
        }
        if (index < 0) return null;
        if (trimmed === "PARSE_ERROR") {
            offsets[index] = null;
            continue;
        }
        if (!/^\d+$/.test(trimmed)) return null;
        const current = offsets[index];
        if (current) current.push(Number(trimmed));
    }

    if (seen.size !== scriptCount) return null;
    return offsets;
}

async function probeStatementOffsets (shell: string, scripts: string[]): Promise<Array<number[] | null> | null> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gcl-ps-"));
    try {
        const jsonPath = path.join(dir, "scripts.json");
        const probePath = path.join(dir, "probe.ps1");
        await fs.writeFile(jsonPath, JSON.stringify(scripts), "utf8");
        await fs.writeFile(probePath, POWERSHELL_STATEMENT_PROBE, "utf8");

        const result = await execa(shell, [
            "-NoProfile", "-NoLogo", "-NonInteractive", "-ExecutionPolicy", "Bypass",
            "-File", probePath,
        ], {
            env: {...process.env, GCL_PS_PARSE_FILE: jsonPath},
            reject: false,
            windowsHide: true,
        });
        if (result.exitCode !== 0) return null;
        return parseProbeOutput(result.stdout, scripts.length);
    } catch {
        return null;
    } finally {
        await fs.remove(dir);
    }
}

export async function insertPowerShellStatusChecks (shell: string, scripts: string[]): Promise<string[]> {
    let probed: Array<number[] | null> | null;
    try {
        probed = await probeStatementOffsets(shell, scripts);
    } catch {
        probed = null;
    }
    if (probed == null) {
        return scripts.map((script) => `${script}\n${POWERSHELL_STATUS_CHECK}\n`);
    }
    return scripts.map((script, index) => {
        const offsets = probed[index];
        // A script that does not parse must be left unchanged so the later failure points at the user's code.
        if (offsets == null) return script;
        return applyStatusChecks(script, offsets);
    });
}
