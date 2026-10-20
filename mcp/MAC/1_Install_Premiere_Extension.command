#!/bin/bash
cd "$(dirname "$0")"
if bash ./install.sh panel; then
  echo; echo "Instalacao concluida."; echo "Reinicie o Premiere Pro e abra: Window > Extensions > PR MCP Bridge"
else
  echo; echo "Instalacao falhou. Veja a mensagem acima."
fi
read -n 1 -s -r -p "Pressione qualquer tecla para fechar..."; echo
