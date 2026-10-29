@echo off
cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" "%~dp0scripts\start-supervisor.cjs"
pause
