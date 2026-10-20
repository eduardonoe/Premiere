#!/bin/bash
# Premiere MCP - macOS uninstaller
NAME=premiere-bridge
SUP="$HOME/Library/Application Support"
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$HOME/.npm-global/bin:$PATH"
rm -rf "$SUP/Adobe/CEP/extensions/com.prmcp.bridge" "$SUP/prmcp" "$HOME/.claude/skills/$NAME" "$HOME/.codex/skills/$NAME"
command -v claude >/dev/null && claude mcp remove -s user $NAME >/dev/null 2>&1
CFG="$HOME/.codex/config.toml"
[ -f "$CFG" ] && awk -v n="$NAME" '/^\[/{skip = index($0, "[mcp_servers." n) == 1} !skip' "$CFG" > "$CFG.tmp" && mv "$CFG.tmp" "$CFG"
echo "Premiere MCP removido."
