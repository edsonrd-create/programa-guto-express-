@echo off
setlocal
cd /d "%~dp0"

echo =====================================
echo GUTO V53 - INSTALAR E INICIAR (dev)
echo =====================================
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado.
  echo Instale o Node.js LTS e rode este arquivo novamente.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo NPM nao encontrado.
  pause
  exit /b 1
)

echo.
echo [1/4] Instalando dependencias do backend...
cd /d "%~dp0backend"
call npm install
if errorlevel 1 (
  echo Erro ao instalar dependencias do backend.
  pause
  exit /b 1
)

echo.
echo [2/4] Instalando dependencias do painel (frontend)...
cd /d "%~dp0frontend"
call npm install
if errorlevel 1 (
  echo Erro ao instalar dependencias do frontend.
  pause
  exit /b 1
)

cd /d "%~dp0"
echo.
echo [3/4] Garantindo canais de integracao no banco...
call npm run seed:integrations
if errorlevel 1 (
  echo Aviso: seed pode ter falhado (verifique se backend instala OK^).
)

echo.
echo [4/4] Proximo passo: DUAS janelas
echo   A) SUBIR-BACKEND.cmd   - API em http://127.0.0.1:3210/health
echo   B) SUBIR-PAINEL.cmd    - Painel em http://127.0.0.1:5173/
echo.
echo Documentacao da equipa: docs\EQUIPE-DESENVOLVIMENTO.md
pause
