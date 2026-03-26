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
echo === Guto V53 - API + WebSocket ===
echo Pasta: %CD%
echo API:    http://127.0.0.1:3210/health   (PORT=3220 se 3210 ocupada)
echo Painel dev: rode SUBIR-PAINEL.cmd -^> http://127.0.0.1:5173/
echo.
call npm run dev
echo.
echo Servidor encerrado ou erro acima.
pause
