<#
  install.ps1 — instala o Premiere Toolkit como plugin UXP local.

  Copia o plugin para %APPDATA%\Adobe\UXP\Plugins\External\<id>_<versao>
  e registra a entrada em PluginsInfo\v1\premierepro.json, que e onde o
  Premiere le a lista de plugins locais.

  Nao precisa de UAC: tudo mora no perfil do usuario.
#>

param([switch]$Uninstall)

$ErrorActionPreference = 'Stop'

# O mesmo script serve a dois arranjos:
#   repositorio -> install\install.ps1  com os fontes em ..\plugin\
#   zip         -> tudo lado a lado na mesma pasta
# Procurar o manifest nos dois lugares evita manter duas versoes do instalador.
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = $null
foreach ($cand in @($here, (Join-Path (Split-Path -Parent $here) 'plugin'))) {
  if (Test-Path (Join-Path $cand 'manifest.json')) { $src = $cand; break }
}
if (-not $src) { throw "manifest.json nao encontrado em $here nem em ..\plugin" }
$manifestPath = Join-Path $src 'manifest.json'

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$id      = $manifest.id
$version = $manifest.version
$name    = $manifest.name
$minVer  = $manifest.host.minVersion

$uxpRoot  = Join-Path $env:APPDATA 'Adobe\UXP'
$external = Join-Path $uxpRoot 'Plugins\External'
$infoPath = Join-Path $uxpRoot 'PluginsInfo\v1\premierepro.json'
$dest     = Join-Path $external ("{0}_{1}" -f $id, $version)

function Write-Registry($plugins) {
  $dir = Split-Path -Parent $infoPath
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $payload = [ordered]@{ plugins = @($plugins) }
  # -Compress: e assim que o Premiere grava o arquivo
  $json = $payload | ConvertTo-Json -Depth 6 -Compress
  [System.IO.File]::WriteAllText($infoPath, $json, (New-Object System.Text.UTF8Encoding($false)))
}

function Read-Registry {
  if (-not (Test-Path $infoPath)) { return @() }
  $raw = Get-Content $infoPath -Raw
  if (-not $raw.Trim()) { return @() }
  $obj = $raw | ConvertFrom-Json
  if ($null -eq $obj.plugins) { return @() }
  return @($obj.plugins)
}

# ---- avisa se o Premiere estiver aberto ----
$running = Get-Process | Where-Object { $_.ProcessName -like 'Adobe Premiere Pro*' }
if ($running) {
  Write-Host ''
  Write-Host '  O Premiere Pro esta aberto.' -ForegroundColor Yellow
  Write-Host '  A instalacao funciona, mas voce precisa REINICIAR o Premiere para o painel aparecer.'
  Write-Host ''
}

# ---- remove versoes anteriores deste mesmo plugin ----
if (Test-Path $external) {
  Get-ChildItem $external -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like ($id + '_*') } |
    ForEach-Object {
      Write-Host ("  removendo versao anterior: " + $_.Name) -ForegroundColor DarkGray
      Remove-Item $_.FullName -Recurse -Force
    }
}

$plugins = Read-Registry | Where-Object { $_.pluginId -ne $id }

if ($Uninstall) {
  Write-Registry $plugins
  Write-Host ''
  Write-Host ("  $name desinstalado.") -ForegroundColor Green
  Write-Host '  Reinicie o Premiere Pro.'
  Write-Host ''
  return
}

# ---- copia os arquivos ----
New-Item -ItemType Directory -Force -Path $dest | Out-Null

$files = @('manifest.json', 'index.html', 'styles.css')
foreach ($f in $files) {
  $p = Join-Path $src $f
  if (-not (Test-Path $p)) { throw "arquivo faltando: $f" }
  Copy-Item $p -Destination $dest -Force
}
foreach ($d in @('helpers', 'icons')) {
  $p = Join-Path $src $d
  if (Test-Path $p) { Copy-Item $p -Destination $dest -Recurse -Force }
}

# ---- build: src/*.js -> main.js flat ----
# A UXP nao carrega ES modules no painel, entao os fontes modulares de src/
# viram um unico script classico. A ordem e a alfabetica dos prefixos (00,10,...).
$parts = Get-ChildItem (Join-Path $src 'src') -Filter '*.js' | Sort-Object Name
if (-not $parts) { throw 'nenhum fonte em src/' }
$sb = New-Object System.Text.StringBuilder
# ASCII apenas: o PS 5.1 le .ps1 sem BOM como ANSI e transformaria um
# travessao em mojibake dentro do arquivo gerado.
[void]$sb.AppendLine('/* Premiere Toolkit - gerado por install.ps1 a partir de src/. Nao edite. */')
foreach ($p in $parts) {
  [void]$sb.AppendLine('')
  [void]$sb.AppendLine(('/* ===== ' + $p.Name + ' ===== */'))
  # ReadAllText com UTF8 explicito: Get-Content -Raw le como ANSI no PS 5.1 e
  # transforma cada acento/traco em mojibake a cada build.
  [void]$sb.AppendLine([System.IO.File]::ReadAllText($p.FullName, [System.Text.Encoding]::UTF8))
}
[System.IO.File]::WriteAllText(
  (Join-Path $dest 'main.js'), $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("  build: " + $parts.Count + " fontes -> main.js") -ForegroundColor DarkGray

# ---- registra ----
$entry = [ordered]@{
  hostMinVersion = $minVer
  name           = $name
  path           = '$localPlugins\External\' + ("{0}_{1}" -f $id, $version)
  pluginId       = $id
  status         = 'enabled'
  type           = 'uxp'
  versionString  = $version
}
$plugins = @($plugins) + [pscustomobject]$entry
Write-Registry $plugins

Write-Host ''
Write-Host ("  $name v$version instalado.") -ForegroundColor Green
Write-Host ("  -> $dest") -ForegroundColor DarkGray

# ---- regenera os zips de distribuicao ----
# Quem instala, empacota: assim os pacotes das duas plataformas nunca ficam
# atrasados em relacao ao codigo. Silencioso quando o node nao existe, e
# quando o script roda de dentro do zip (onde nao ha tools/).
$packer = Join-Path (Split-Path -Parent $here) 'tools\pack.mjs'
if (Test-Path $packer) {
  Write-Host ''
  try {
    $out = & node $packer 2>&1
    foreach ($line in $out) { Write-Host ("  " + $line) -ForegroundColor DarkGray }
  } catch {
    Write-Host '  node nao encontrado: os zips nao foram regerados' -ForegroundColor DarkYellow
  }
}

Write-Host ''
Write-Host '  Reinicie o Premiere Pro e abra em:  Window > UXP Plugins > Premiere Toolkit'
Write-Host ''
