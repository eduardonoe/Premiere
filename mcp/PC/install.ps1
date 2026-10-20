# Premiere MCP 1.0.0 - installer. -Part panel = extensao do Premiere; -Part agents = MCP + skill nos agentes
param([ValidateSet('all','panel','agents')][string]$Part = 'all')
# 1) CEP panel  2) MCP server  3) Claude Code + Codex registration  4) agent skill
$ErrorActionPreference = 'Stop'
$root   = Split-Path -Parent $PSScriptRoot
$name   = 'premiere-bridge'
$appDir = Join-Path $env:APPDATA 'prmcp'
$srvDir = Join-Path $appDir 'server'
$extDir = Join-Path $env:APPDATA 'Adobe\CEP\extensions'
$panel  = Join-Path $extDir 'com.prmcp.bridge'

if ($Part -ne 'panel' -and !(Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js nao encontrado. Instale em https://nodejs.org e rode de novo.' }

function Remove-Dir($p) {
  if (!(Test-Path -LiteralPath $p)) { return }
  # junction: rmdir removes only the link, never the target
  if ((Get-Item -LiteralPath $p -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { cmd /c rmdir "$p" | Out-Null }
  else { Remove-Item -LiteralPath $p -Recurse -Force }
}

if ($Part -ne 'agents') {
Write-Host '[1/4] Painel CEP'
New-Item -ItemType Directory -Path $extDir -Force | Out-Null
Remove-Dir $panel
Remove-Dir (Join-Path $extDir 'com.codex.premiere-pro-full-mcp.cep')  # MCP antigo de terceiros
Copy-Item (Join-Path $root 'cep-panel') $panel -Recurse
9..13 | ForEach-Object { $k = "HKCU:\Software\Adobe\CSXS.$_"; New-Item -Path $k -Force | Out-Null
  New-ItemProperty -Path $k -Name PlayerDebugMode -Value '1' -PropertyType String -Force | Out-Null }

}
if ($Part -eq 'panel') { return }

Write-Host '[2/4] Servidor MCP'
New-Item -ItemType Directory -Path $srvDir -Force | Out-Null
'index.js','package.json','package-lock.json' | ForEach-Object { Copy-Item (Join-Path $root "server\$_") $srvDir -Force }
Push-Location $srvDir; try { cmd /c "npm ci --omit=dev --no-audit --no-fund --loglevel=error"; if ($LASTEXITCODE) { throw 'npm ci falhou' } } finally { Pop-Location }
$entry = Join-Path $srvDir 'index.js'

Write-Host '[3/4] Registro nos agentes'
if (Get-Command claude -ErrorAction SilentlyContinue) {
  cmd /c "claude mcp remove -s user $name >nul 2>&1"
  cmd /c "claude mcp add -s user $name -- node `"$entry`""
  Write-Host '  Claude Code: ok'
} else { Write-Host '  Claude Code: nao encontrado (pulado)' }

$codexDir = Join-Path $env:USERPROFILE '.codex'
if (Test-Path $codexDir) {
  $cfg = Join-Path $codexDir 'config.toml'
  $toml = if (Test-Path $cfg) { [IO.File]::ReadAllText($cfg) } else { '' }
  # drop any previous [mcp_servers.premiere-bridge] block (and its subtables) before appending
  $toml = [regex]::Replace($toml, "(?ms)^\[mcp_servers\.$name(\.[^\]]*)?\]\r?\n.*?(?=^\[(?!mcp_servers\.$name)|\z)", '')
  $block = "[mcp_servers.$name]`r`ncommand = 'node'`r`nargs = ['$entry']`r`n"
  [IO.File]::WriteAllText($cfg, $toml.TrimEnd() + "`r`n`r`n" + $block, (New-Object Text.UTF8Encoding $false))
  Write-Host '  Codex: ok'
} else { Write-Host '  Codex: nao encontrado (pulado)' }

Write-Host '[4/4] Skill dos agentes'
foreach ($d in @((Join-Path $env:USERPROFILE '.claude\skills'), (Join-Path $codexDir 'skills'))) {
  if (!(Test-Path (Split-Path $d))) { continue }
  $dst = Join-Path $d $name
  Remove-Dir $dst
  New-Item -ItemType Directory -Path $d -Force | Out-Null
  Copy-Item (Join-Path $root "skill\$name") $dst -Recurse
  Write-Host "  $dst"
}
