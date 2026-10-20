@echo off
setlocal
title Premiere Toolkit - Desinstalador
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -Uninstall
echo.
pause
