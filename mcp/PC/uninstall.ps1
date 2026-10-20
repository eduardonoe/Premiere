# Premiere MCP - uninstaller (called by Uninstall_Premiere_MCP.bat)
$ErrorActionPreference = 'Continue'
$name = 'premiere-bridge'
function Remove-Dir($p) {
  if (!(Test-Path -LiteralPath $p)) { return }
  if ((Get-Item -LiteralPath $p -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { cmd /c rmdir "$p" | Out-Null }
  else { Remove-Item -LiteralPath $p -Recurse -Force }
}
Remove-Dir (Join-Path $env:APPDATA 'Adobe\CEP\extensions\com.prmcp.bridge')
Remove-Dir (Join-Path $env:APPDATA 'prmcp')
Remove-Dir (Join-Path $env:USERPROFILE ".claude\skills\$name")
Remove-Dir (Join-Path $env:USERPROFILE ".codex\skills\$name")
if (Get-Command claude -ErrorAction SilentlyContinue) { cmd /c "claude mcp remove -s user $name >nul 2>&1" }
$cfg = Join-Path $env:USERPROFILE '.codex\config.toml'
if (Test-Path $cfg) {
  $toml = [regex]::Replace([IO.File]::ReadAllText($cfg), "(?ms)^\[mcp_servers\.$name(\.[^\]]*)?\]\r?\n.*?(?=^\[(?!mcp_servers\.$name)|\z)", '')
  [IO.File]::WriteAllText($cfg, $toml.TrimEnd() + "`r`n", (New-Object Text.UTF8Encoding $false))
}
Write-Host 'Premiere MCP removido.'
