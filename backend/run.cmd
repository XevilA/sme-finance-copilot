@echo off
REM Starts the API from cmd.exe, PowerShell or a double-click.
REM Configuration is read from backend\.env - no environment variables to export.
REM Override the port with:  set PORT=8001 ^&^& backend\run.cmd
setlocal
cd /d "%~dp0.."
if "%PORT%"=="" set PORT=8000

if not exist "backend\.venv\Scripts\python.exe" (
    echo Virtualenv missing. Create it with: python -m venv backend\.venv
    exit /b 1
)
if not exist "backend\.env" copy "backend\.env.example" "backend\.env" >nul

REM Fail early with a readable message instead of WinError 10048 on bind.
set BUSY=
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do set BUSY=%%p
if defined BUSY (
    echo Port %PORT% is already in use by PID %BUSY%.
    echo.
    echo   Stop it:          taskkill /PID %BUSY% /T /F
    echo   Or use another:   set PORT=8001 ^&^& backend\run.cmd
    echo.
    echo A uvicorn started with --reload leaves a worker holding the socket,
    echo so stop the whole tree with /T, not just the parent process.
    exit /b 1
)

echo Starting on http://127.0.0.1:%PORT%  (docs at /docs)
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port %PORT% %*
