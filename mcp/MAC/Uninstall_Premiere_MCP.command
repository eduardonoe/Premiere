#!/bin/bash
cd "$(dirname "$0")"
if bash ./uninstall.sh; then
  echo; echo "Instalacao concluida."; echo ""
else
  echo; echo "Instalacao falhou. Veja a mensagem acima."
fi
read -n 1 -s -r -p "Pressione qualquer tecla para fechar..."; echo
