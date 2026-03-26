@echo off
setlocal
cd /d "%~dp0frontend"
if not exist "package.json" (
  echo ERRO: pasta frontend nao encontrada.
  echo Caminho esperado: %~dp0frontend
  pause
  exit /b 1
)
echo.
echo === Guto V53 - Painel React (Vite) ===
echo Pasta: %CD%
echo URL:   http://127.0.0.1:5173/  (proxy API -> 127.0.0.1:3210; use VITE_PROXY_API se outra porta)
echo.
call npm run dev
echo.
echo Vite encerrado ou erro acima.
pause
