@echo off
setlocal
cd /d "%~dp0"

echo =====================================
echo GUTO V53 - RECUPERAR TUDO (1 porta)
echo =====================================
echo Instala dependencias, canais de integracao, compila o painel e abre SO o backend.
echo Acesse: http://127.0.0.1:3210/
echo =====================================

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale o Node.js LTS.
  pause
  exit /b 1
)

call npm run recuperar
if errorlevel 1 (
  echo Erro no passo acima.
  pause
  exit /b 1
)

echo.
echo Abrindo servidor...
start "Guto V53 - API + Painel" cmd /k "%~dp0SUBIR-BACKEND.cmd"
echo Pronto. Abra: http://127.0.0.1:3210/
pause
