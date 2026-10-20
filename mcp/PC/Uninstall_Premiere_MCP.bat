@echo off
setlocal EnableExtensions
title Premiere MCP Uninstaller
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
pause
