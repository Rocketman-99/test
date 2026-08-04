@echo off
REM ---------------------------------------------------------------
REM  Job Prep App launcher
REM
REM   start.bat            normal start (rebuilds only if sources changed)
REM   start.bat rebuild    force a full rebuild
REM
REM  All messages are English on purpose: the Windows console codepage
REM  garbles Korean text in .bat files.
REM ---------------------------------------------------------------
setlocal
title Job Prep App
cd /d "%~dp0"

set "NEED_BUILD=0"

REM ---- 1. packages -------------------------------------------------
if not exist "node_modules" (
    echo Installing packages. This may take a few minutes...
    call npm install
    if errorlevel 1 goto :installfail
    set "NEED_BUILD=1"
)

REM ---- 2. decide whether to rebuild --------------------------------
if "%NEED_BUILD%"=="1"       goto :dobuild
if not exist ".next\BUILD_ID" goto :dobuild
if /i "%~1"=="rebuild"       goto :dobuild
if /i "%~1"=="-rebuild"      goto :dobuild
if /i "%~1"=="/rebuild"      goto :dobuild

REM Any source file newer than the last build means the build is stale.
REM git pull refreshes mtimes, so a pull alone triggers this.
echo Checking for source changes...
set "CHANGED=0"
for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$b=Get-Item '.next\BUILD_ID' -EA SilentlyContinue; if(-not $b){Write-Output 1; exit}; $f=Get-ChildItem -Path 'app','components','lib','types','package.json','next.config.ts','tsconfig.json' -Recurse -File -EA SilentlyContinue; $r=0; foreach($x in $f){ if($x.LastWriteTime -gt $b.LastWriteTime){$r=1; break} }; Write-Output $r"`) do set "CHANGED=%%i"
if "%CHANGED%"=="1" goto :dobuild

echo No changes found. Using the existing build.
goto :startserver

:dobuild
echo.
echo Building app. This may take a few minutes...
call npm run build
if errorlevel 1 goto :buildfail

:startserver
echo.
echo Stopping any previous server...
taskkill /f /im node.exe >nul 2>&1

echo Starting server...
REM Open the browser a few seconds later, once the server is listening.
start "" /b cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3000"

echo.
echo ---------------------------------------------------------------
echo  Server log follows. CLOSE THIS WINDOW TO STOP THE SERVER.
echo  Force a rebuild next time with:  start.bat rebuild
echo ---------------------------------------------------------------
echo.
npm run start
exit /b 0

:installfail
echo [ERROR] npm install failed.
pause
exit /b 1

:buildfail
echo [ERROR] Build failed.
pause
exit /b 1
