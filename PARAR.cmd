@echo off
echo Encerrando processos Node/Vite...
taskkill /f /im node.exe >nul 2>nul
echo Finalizado.
pause