@echo off
setlocal
cd /d "%~dp0"
echo Backup do SQLite (backend/database.sqlite -^> backend/data/backups/)
node backend\scripts\backup-db.mjs
if errorlevel 1 (
  echo.
  echo Falhou: confirme que o backend ja correu pelo menos uma vez ^(ficheiro database.sqlite^).
  pause
  exit /b 1
)
pause
