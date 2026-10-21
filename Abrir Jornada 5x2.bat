@echo off
rem Abre o assistente Jornada 5x2 no navegador. Mantenha esta janela aberta enquanto usa o site.
title Jornada 5x2
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale em https://nodejs.org e tente novamente.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando dependencias - somente na primeira vez...
  call npm install
)

echo.
echo Preparando o site e abrindo o navegador em http://localhost:5173 ...
echo Para encerrar, feche esta janela.
echo.
call npm run site
pause
