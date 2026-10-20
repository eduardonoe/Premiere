#!/bin/bash
cd "$(dirname "$0")"
if bash ./install.sh agents; then
  echo; echo "Instalacao concluida."; echo "Reinicie o Claude Code / Codex para carregar o MCP premiere-bridge."
else
  echo; echo "Instalacao falhou. Veja a mensagem acima."
fi
read -n 1 -s -r -p "Pressione qualquer tecla para fechar..."; echo
