@echo off
setlocal
cd /d "%~dp0backend"
if not exist "package.json" (
  echo ERRO: pasta backend nao encontrada.
  echo Caminho esperado: %~dp0backend
  pause
  exit /b 1
)
echo.
echo === Guto V53 - Backend + painel (se existir dist) ===
echo Pasta: %CD%
echo Painel + API: http://127.0.0.1:3210/
echo Health:       http://127.0.0.1:3210/health
echo.
call npm run dev
echo.
echo Servidor encerrado ou erro acima.
pause
