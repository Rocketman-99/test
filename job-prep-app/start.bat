@echo off
REM ---------------------------------------------------------------
REM  Job Prep App launcher
REM
REM   start.bat            check GitHub for updates, then start
REM   start.bat rebuild    force a full rebuild
REM   start.bat noupdate   skip the update check
REM
REM  All messages are English on purpose: the Windows console codepage
REM  garbles Korean text in .bat files.
REM ---------------------------------------------------------------
setlocal enabledelayedexpansion
title Job Prep App
cd /d "%~dp0"

REM git commit messages are UTF-8 Korean; without this they render as mojibake.
chcp 65001 >nul

set "FORCE_BUILD=0"
set "SKIP_UPDATE=0"
if /i "%~1"=="rebuild"  set "FORCE_BUILD=1"
if /i "%~1"=="noupdate" set "SKIP_UPDATE=1"

REM ---- 0. check GitHub for updates --------------------------------
if "%SKIP_UPDATE%"=="1" goto :afterupdate

where git >nul 2>&1
if errorlevel 1 (
    echo Skipping update check: git is not installed.
    goto :afterupdate
)

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo Skipping update check: this folder is not a git clone.
    goto :afterupdate
)

set "BRANCH="
for /f "usebackq delims=" %%b in (`git rev-parse --abbrev-ref HEAD 2^>nul`) do set "BRANCH=%%b"
if not defined BRANCH (
    echo Skipping update check: could not determine the branch.
    goto :afterupdate
)

echo Checking GitHub for updates on branch !BRANCH! ...
REM Fail fast instead of hanging on a credential prompt.
set "GIT_TERMINAL_PROMPT=0"
git fetch origin !BRANCH! >nul 2>&1
if errorlevel 1 (
    echo Could not reach GitHub. Continuing with the local version.
    goto :afterupdate
)

set "BEHIND="
for /f "usebackq delims=" %%c in (`git rev-list --count HEAD..origin/!BRANCH! 2^>nul`) do set "BEHIND=%%c"
if not defined BEHIND goto :afterupdate
if "!BEHIND!"=="0" (
    echo Already up to date.
    goto :afterupdate
)

echo.
echo ===============================================================
echo   !BEHIND! new update^(s^) available on GitHub
echo ===============================================================
echo.
echo   What changed:
echo.
git log --no-merges --pretty=format:"   - %%s" HEAD..origin/!BRANCH!
echo.
echo.
echo   Files affected:
echo.
git diff --name-only HEAD origin/!BRANCH!
echo.
echo ===============================================================
echo.

REM Never overwrite uncommitted local edits.
set "DIRTY="
for /f "usebackq delims=" %%d in (`git status --porcelain 2^>nul`) do set "DIRTY=1"
if defined DIRTY (
    echo [WARNING] You have local changes that are not committed.
    echo Updating could overwrite them, so the update was skipped.
    echo.
    pause
    goto :afterupdate
)

set "ANSWER="
set /p "ANSWER=Apply this update now? [y/N] "
if /i not "!ANSWER!"=="y" (
    echo Update skipped. Starting the current version.
    goto :afterupdate
)

echo.
echo Updating...
git merge --ff-only origin/!BRANCH!
if errorlevel 1 (
    echo.
    echo [ERROR] Update failed. Starting the current version instead.
    echo.
    pause
    goto :afterupdate
)
echo Update complete.
set "FORCE_BUILD=1"

:afterupdate

REM ---- 1. packages -------------------------------------------------
if not exist "node_modules" (
    echo.
    echo Installing packages. This may take a few minutes...
    call npm install
    if errorlevel 1 goto :installfail
    set "FORCE_BUILD=1"
)

REM ---- 2. decide whether to rebuild --------------------------------
if "!FORCE_BUILD!"=="1"       goto :dobuild
if not exist ".next\BUILD_ID" goto :dobuild

REM Any source file newer than the last build means the build is stale.
echo Checking for source changes...
set "CHANGED=0"
for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$b=Get-Item '.next\BUILD_ID' -EA SilentlyContinue; if(-not $b){Write-Output 1; exit}; $f=Get-ChildItem -Path 'app','components','lib','types','package.json','next.config.ts','tsconfig.json' -Recurse -File -EA SilentlyContinue; $r=0; foreach($x in $f){ if($x.LastWriteTime -gt $b.LastWriteTime){$r=1; break} }; Write-Output $r"`) do set "CHANGED=%%i"
if "!CHANGED!"=="1" goto :dobuild

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
echo.
echo  start.bat rebuild    force a rebuild
echo  start.bat noupdate   skip the update check
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
