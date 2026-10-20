#!/bin/bash
# Premiere MCP 1.0.0 - macOS installer. install.sh panel | agents
set -e
PART="${1:-all}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAME=premiere-bridge
SUP="$HOME/Library/Application Support"
SRV="$SUP/prmcp/server"
PANEL="$SUP/Adobe/CEP/extensions/com.prmcp.bridge"
# .command runs with a minimal PATH: add the usual node/claude locations
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$HOME/.npm-global/bin:$PATH"

if [ "$PART" != agents ]; then
  echo "[1/4] Painel CEP"
  rm -rf "$PANEL"; mkdir -p "$(dirname "$PANEL")"
  cp -R "$ROOT/cep-panel" "$PANEL"
  for v in 9 10 11 12 13; do defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1; done
  xattr -dr com.apple.quarantine "$PANEL" 2>/dev/null || true
fi
[ "$PART" = panel ] && exit 0

command -v node >/dev/null || { echo "Node.js nao encontrado. Instale em https://nodejs.org e rode de novo."; exit 1; }
echo "[2/4] Servidor MCP"
mkdir -p "$SRV"
cp "$ROOT/server/index.js" "$ROOT/server/package.json" "$ROOT/server/package-lock.json" "$SRV/"
(cd "$SRV" && npm ci --omit=dev --no-audit --no-fund --loglevel=error)
ENTRY="$SRV/index.js"

echo "[3/4] Registro nos agentes"
if command -v claude >/dev/null; then
  claude mcp remove -s user $NAME >/dev/null 2>&1 || true
  claude mcp add -s user $NAME -- node "$ENTRY"
  echo "  Claude Code: ok"
else echo "  Claude Code: nao encontrado (pulado)"; fi
if [ -d "$HOME/.codex" ]; then
  CFG="$HOME/.codex/config.toml"; touch "$CFG"
  # drop any previous [mcp_servers.premiere-bridge] block (and subtables), then append
  awk -v n="$NAME" '/^\[/{skip = index($0, "[mcp_servers." n) == 1} !skip' "$CFG" > "$CFG.tmp" && mv "$CFG.tmp" "$CFG"
  printf '\n[mcp_servers.%s]\ncommand = "%s"\nargs = ["%s"]\n' "$NAME" "$(command -v node)" "$ENTRY" >> "$CFG"
  echo "  Codex: ok"
else echo "  Codex: nao encontrado (pulado)"; fi

echo "[4/4] Skill dos agentes"
for d in "$HOME/.claude/skills" "$HOME/.codex/skills"; do
  [ -d "$(dirname "$d")" ] || continue
  rm -rf "$d/$NAME"; mkdir -p "$d"; cp -R "$ROOT/skill/$NAME" "$d/$NAME"; echo "  $d/$NAME"
done
