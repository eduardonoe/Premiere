# Premiere MCP - v1.0.0

Ponte propria entre agentes de IA (Claude Code, Codex) e o Adobe Premiere Pro.

- `cep-panel/` - painel CEP "PR MCP Bridge": HTTP em `127.0.0.1:47300`, exige
  o token de `%APPDATA%\prmcp\token` (gerado pelo painel) e executa ExtendScript.
- `server/` - servidor MCP stdio `premiere-bridge` com `premiere_run`,
  `premiere_status` e `premiere_frame`.
- `skill/premiere-bridge/` - skill instalada nos agentes com o uso e as armadilhas.
- `PC/`, `MAC/` - instaladores.

## Instalar (Windows e macOS)

Requer Node.js. Instrucoes para o usuario final em `LEIA-ME.txt`.

- `PC/` - `1_Install_Premiere_Extension.bat`, `2_Install_AI_Agents.bat`, `Uninstall_Premiere_MCP.bat` (logica em `install.ps1`).
- `MAC/` - os mesmos em `.command` (logica em `install.sh`).

Passo 1 instala o painel CEP e liga o PlayerDebugMode. Passo 2 copia o servidor para
`%APPDATA%\prmcp\server` (Mac: `~/Library/Application Support/prmcp/server`), roda `npm ci`,
registra `premiere-bridge` no Claude Code (escopo user) e no Codex (`~/.codex/config.toml`)
e instala a skill em `~/.claude/skills` e `~/.codex/skills`. Reinstalar e seguro.

`Premiere_MCP_1.0.0.zip` e o pacote pronto para distribuir (regerar a cada versao, ver `VERSIONING.md`).

## Changelog

v1.0.0
- Primeira versao organizada: painel + servidor + skill com instalador unico.
- Instaladores PC e MAC e pacote `Premiere_MCP_1.0.0.zip` para distribuir.
- Substitui o premiere-pro-full-mcp (terceiros), removido.
