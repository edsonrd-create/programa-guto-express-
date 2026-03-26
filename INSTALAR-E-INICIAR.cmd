@echo off
setlocal
cd /d "%~dp0"

echo =====================================
echo GUTO V53 - INSTALAR E INICIAR
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
  echo Instale o Node.js LTS e rode este arquivo novamente.
  pause
  exit /b 1
)

echo.
echo [1/4] Instalando dependencias do backend...
cd backend
call npm install
if errorlevel 1 (
  echo Erro ao instalar dependencias do backend.
  pause
  exit /b 1
)

echo.
echo [2/5] Instalando dependencias do painel...
cd ..\apps\admin-web
call npm install
if errorlevel 1 (
  echo Erro ao instalar dependencias do painel.
  pause
  exit /b 1
)

cd ..\..

echo.
echo [3/5] Compilando painel (gera apps\admin-web\dist)...
call npm run build:admin
if errorlevel 1 (
  echo Erro ao compilar o painel.
  pause
  exit /b 1
)

echo.
echo [4/5] Garantindo canais de integracao no banco...
call npm run seed:integrations

echo.
echo [5/5] Iniciando servidor unico (API + painel na mesma porta)...
start "Guto V53 - API + Painel" cmd /k "%~dp0SUBIR-BACKEND.cmd"
echo.
echo Aguarde alguns segundos e abra no navegador:
echo   http://127.0.0.1:3210/        ^(painel^)
echo   http://127.0.0.1:3210/health  ^(API^)
echo.
echo Opcional ^(hot reload, precisa porta livre 5173^): SUBIR-PAINEL.cmd
pause
