@echo off
cd /d "%~dp0"
title Cazapiezas - Impresion movil
echo.
echo  CAZAPIEZAS - IMPRESION DESDE EL MOVIL
echo  ======================================
echo.
echo  Deja esta ventana abierta mientras quieras imprimir.
echo  Para detener el puente, cierra esta ventana.
echo.
node scripts\print-bridge.cjs
echo.
echo  El puente se ha detenido.
pause
