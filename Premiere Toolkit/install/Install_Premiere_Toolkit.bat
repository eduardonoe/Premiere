@echo off
setlocal
title Premiere Toolkit - Instalador
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
pause
