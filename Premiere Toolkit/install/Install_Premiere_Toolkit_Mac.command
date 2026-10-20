#!/bin/bash
#
# Instala o Premiere Toolkit como plugin UXP local no macOS.
#
# Copia para ~/Library/Application Support/Adobe/UXP/Plugins/External/<id>_<versao>
# e registra em PluginsInfo/v1/premierepro.json, que e onde o Premiere le a
# lista de plugins locais. Nao pede senha: tudo mora no perfil do usuario.
#
# Rodar de duas formas:
#   bash "Install_Premiere_Toolkit_Mac.command"     (sempre funciona)
#   duplo-clique                                    (depois de chmod +x, uma vez)
#
# Arquivo vindo do Windows chega sem o bit de execucao — dai a primeira forma.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# O mesmo script serve a dois arranjos:
#   repositorio -> install/Install_..._Mac.command  com os fontes em ../plugin/
#   zip         -> tudo lado a lado na mesma pasta
DIR=""
for cand in "$HERE" "$(dirname "$HERE")/plugin"; do
  if [ -f "$cand/manifest.json" ]; then DIR="$cand"; break; fi
done
if [ -z "$DIR" ]; then
  echo "  manifest.json nao encontrado em $HERE nem em ../plugin" >&2
  exit 1
fi
MANIFEST="$DIR/manifest.json"

# Le um campo simples do manifest sem depender de jq (que nao vem no macOS).
field() {
  sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$MANIFEST" | head -1
}

ID="$(field id)"
VERSION="$(field version)"
NAME="$(field name)"
MINVER="$(sed -n 's/.*"minVersion"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$MANIFEST" | head -1)"

if [ -z "$ID" ] || [ -z "$VERSION" ]; then
  echo "  nao consegui ler id/version do manifest.json" >&2
  exit 1
fi

UXP="$HOME/Library/Application Support/Adobe/UXP"
EXTERNAL="$UXP/Plugins/External"
INFO="$UXP/PluginsInfo/v1/premierepro.json"
DEST="$EXTERNAL/${ID}_${VERSION}"

UNINSTALL=0
if [ "${1:-}" = "--uninstall" ]; then UNINSTALL=1; fi

echo ""
if pgrep -x "Adobe Premiere Pro" >/dev/null 2>&1; then
  echo "  O Premiere Pro esta aberto."
  echo "  A instalacao funciona, mas voce precisa REINICIAR o Premiere."
  echo ""
fi

# ---- remove versoes anteriores deste mesmo plugin ----
if [ -d "$EXTERNAL" ]; then
  for old in "$EXTERNAL/${ID}_"*; do
    [ -d "$old" ] || continue
    echo "  removendo versao anterior: $(basename "$old")"
    rm -rf "$old"
  done
fi

# ---- registro: JSON via JXA, que sempre existe no macOS ----
# (jq nao vem instalado; python3 nao e garantido; osascript vem sempre)
register() {
  local mode="$1"
  osascript -l JavaScript \
    -e 'function run(argv) {' \
    -e '  ObjC.import("Foundation");' \
    -e '  var mode = argv[0], info = argv[1], id = argv[2], version = argv[3];' \
    -e '  var name = argv[4], minVer = argv[5];' \
    -e '  var fm = $.NSFileManager.defaultManager;' \
    -e '  var dir = info.substring(0, info.lastIndexOf("/"));' \
    -e '  fm.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(dir, true, $(), null);' \
    -e '  var plugins = [];' \
    -e '  if (fm.fileExistsAtPath(info)) {' \
    -e '    var raw = $.NSString.stringWithContentsOfFileEncodingError(info, $.NSUTF8StringEncoding, null);' \
    -e '    if (raw && raw.js && raw.js.trim().length) {' \
    -e '      try { var o = JSON.parse(raw.js); if (o && o.plugins) plugins = o.plugins; } catch (e) {}' \
    -e '    }' \
    -e '  }' \
    -e '  plugins = plugins.filter(function (p) { return p.pluginId !== id; });' \
    -e '  if (mode === "install") {' \
    -e '    plugins.push({' \
    -e '      hostMinVersion: minVer, name: name,' \
    -e '      path: "$localPlugins/External/" + id + "_" + version,' \
    -e '      pluginId: id, status: "enabled", type: "uxp", versionString: version' \
    -e '    });' \
    -e '  }' \
    -e '  var out = $.NSString.alloc.initWithUTF8String(JSON.stringify({ plugins: plugins }));' \
    -e '  out.writeToFileAtomicallyEncodingError(info, true, $.NSUTF8StringEncoding, null);' \
    -e '  return "ok";' \
    -e '}' \
    "$mode" "$INFO" "$ID" "$VERSION" "$NAME" "${MINVER:-25.6.0}"
}

if [ "$UNINSTALL" = "1" ]; then
  register uninstall >/dev/null
  echo ""
  echo "  $NAME desinstalado."
  echo "  Reinicie o Premiere Pro."
  echo ""
  exit 0
fi

# ---- copia os arquivos ----
mkdir -p "$DEST"
for f in manifest.json index.html styles.css; do
  if [ ! -f "$DIR/$f" ]; then echo "  arquivo faltando: $f" >&2; exit 1; fi
  cp "$DIR/$f" "$DEST/"
done
for d in icons; do
  [ -d "$DIR/$d" ] && cp -R "$DIR/$d" "$DEST/"
done

# helpers/ NAO e copiado: o ppro-uia.ps1 e PowerShell puro, so serve no Windows.

# ---- build: src/*.js -> main.js flat ----
# A UXP nao carrega ES modules no painel, entao os fontes modulares viram um
# unico script classico. A ordem e a alfabetica dos prefixos (05, 10, 20, ...).
COUNT=0
{
  echo "/* Premiere Toolkit - gerado pelo instalador a partir de src/. Nao edite. */"
  for f in "$DIR"/src/*.js; do
    [ -f "$f" ] || continue
    echo ""
    echo "/* ===== $(basename "$f") ===== */"
    cat "$f"
    COUNT=$((COUNT + 1))
  done
} > "$DEST/main.js"

COUNT=$(ls -1 "$DIR"/src/*.js 2>/dev/null | wc -l | tr -d ' ')
echo "  build: $COUNT fontes -> main.js"

register install >/dev/null

echo ""
echo "  $NAME v$VERSION instalado."
echo "  -> $DEST"
echo ""
echo "  Reinicie o Premiere Pro e abra em:  Window > UXP Plugins > Premiere Toolkit"
echo ""
echo "  Nesta plataforma o painel traz apenas o Clean & Organize."
echo "  Delete Empty Tracks e Un-nest dependem de automacao de UI do Windows."
echo ""
