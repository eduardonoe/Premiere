@echo off
setlocal EnableExtensions
title Premiere MCP - Extensao
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -Part panel
if not "%errorlevel%"=="0" (
    echo.
    echo Instalacao falhou. Veja a mensagem acima.
    pause
    exit /b 1
)
echo.
echo Instalacao concluida.
echo Reinicie o Premiere Pro e abra: Window ^> Extensions ^> PR MCP Bridge
echo.
pause
exit /b 0
