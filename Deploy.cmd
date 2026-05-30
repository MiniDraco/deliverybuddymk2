@echo off
REM Double-click to publish DeliveryBuddy MK2 to GitHub Pages.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" %*
echo.
pause
