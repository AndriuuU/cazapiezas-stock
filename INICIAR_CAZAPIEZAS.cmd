@echo off
setlocal
cd /d "%~dp0"
title Cazapiezas - Inicio

echo.
echo  CAZAPIEZAS - INICIO DE LA WEB
echo  =============================
echo.

if not exist "package.json" (
  echo  ERROR: No se encuentra package.json en:
  echo  %CD%
  echo.
  pause
  exit /b 1
)

where node.exe >nul 2>nul
if errorlevel 1 (
  echo  ERROR: Node.js no esta instalado o no esta disponible.
  echo.
  pause
  exit /b 1
)

echo  Iniciando el servidor en una ventana nueva...
start "Cazapiezas - Servidor web" /D "%~dp0" cmd.exe /k npm.cmd run dev

echo  Esperando a que la web este preparada...
powershell.exe -NoProfile -Command "$url = 'http://localhost:3000'; for ($attempt = 0; $attempt -lt 60; $attempt++) { try { Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2 | Out-Null; exit 0 } catch { Start-Sleep -Seconds 1 } }; exit 1"

if errorlevel 1 (
  echo.
  echo  No se ha podido abrir la web porque el servidor no ha respondido.
  echo  Revisa el mensaje de la ventana "Cazapiezas - Servidor web".
  echo.
  pause
  exit /b 1
)

echo  Abriendo Cazapiezas en el navegador...
start "" "http://localhost:3000"
exit /b 0
