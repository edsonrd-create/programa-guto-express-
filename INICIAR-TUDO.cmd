@echo off
setlocal
cd /d "%~dp0"

echo Abrindo servidor (API + painel se existir apps\admin-web\dist)...
echo Se o painel nao aparecer, rode antes na raiz: npm run build:admin
echo.
start "Guto V53 - API + Painel" cmd /k "%~dp0SUBIR-BACKEND.cmd"

echo.
echo Abra: http://127.0.0.1:3210/
echo Hot reload ^(Vite^): SUBIR-PAINEL.cmd  ^(porta 5173^)
echo.
pause
