@echo off
setlocal
cd /d "%~dp0"

echo.
echo === Guto Express - Painel + API ===
echo.
echo A pagina do PAINEL e o Vite na porta 5173.
echo A API Node fica na porta 3210 (JSON /health) — NAO e a interface web.
echo.
echo URL correta no navegador: http://127.0.0.1:5173/
echo.
echo Abrindo duas janelas: backend e frontend...
echo.

start "Guto - API 3210" cmd /k "%~dp0SUBIR-BACKEND.cmd"
timeout /t 2 /nobreak >nul
start "Guto - Painel 5173" cmd /k "%~dp0SUBIR-PAINEL.cmd"

echo Aguarde "ready" no Vite e abra: http://127.0.0.1:5173/
echo Alternativa na raiz do projeto: npm install ^&^& npm run dev
echo.
pause
