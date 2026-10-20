@echo off
setlocal EnableExtensions
title Premiere MCP - Agentes de IA
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -Part agents
if not "%errorlevel%"=="0" (
    echo.
    echo Instalacao falhou. Veja a mensagem acima.
    pause
    exit /b 1
)
echo.
echo Instalacao concluida.
echo Reinicie o Claude Code / Codex para carregar o MCP premiere-bridge.
echo.
pause
exit /b 0
