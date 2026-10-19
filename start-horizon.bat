@echo off
title AISA Horizon - AI-First IDE Studio
echo ========================================================
echo   AISA HORIZON - AI-FIRST IDE STUDIO (MHENT UNIVERSE)
echo ========================================================

set "PATH=C:\Program Files\nodejs;%PATH%"

if exist "dist\win-unpacked\AISA Horizon.exe" (
  echo [Info] Launching Standalone Dist Build...
  start "" "dist\win-unpacked\AISA Horizon.exe"
  exit /b
)

if exist "node_modules\electron\dist\electron.exe" (
  echo [Info] Launching Local Electron...
  start "" "node_modules\electron\dist\electron.exe" .
  exit /b
)

if exist "..\mhent-study\node_modules\electron\dist\electron.exe" (
  echo [Info] Launching Shared Electron Engine from mhent-study...
  start "" "..\mhent-study\node_modules\electron\dist\electron.exe" .
  exit /b
)

if exist "..\mhent-aisa\node_modules\electron\dist\electron.exe" (
  echo [Info] Launching Shared Electron Engine from Aisa...
  start "" "..\mhent-aisa\node_modules\electron\dist\electron.exe" .
  exit /b
)

echo [Info] Launching via npm start...
call npm.cmd start
