#!/bin/bash
# Desinstala o Premiere Toolkit no macOS.
# Rodar:  bash "Uninstall_Premiere_Toolkit_Mac.command"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$DIR/Install_Premiere_Toolkit_Mac.command" --uninstall
