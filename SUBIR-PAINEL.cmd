@echo off
setlocal
cd /d "%~dp0apps\admin-web"
if not exist "package.json" (
  echo ERRO: pasta apps\admin-web nao encontrada.
  echo Caminho esperado: %~dp0apps\admin-web
  pause
  exit /b 1
)
echo.
echo === Guto V53 - Painel (Vite) ===
echo Pasta: %CD%
echo URL:   http://127.0.0.1:5173/  (se a porta estiver ocupada, o Vite mostra outra no terminal)
echo.
call npm run dev
echo.
echo Vite encerrado ou erro acima.
pause
