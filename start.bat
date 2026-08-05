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

REM ---- run from a temp copy ---------------------------------------
REM An update can rewrite this very file while it is running, and cmd.exe
REM keeps reading the batch file from disk by byte offset as it executes.
REM Rewriting the original mid-run corrupts every line after that point,
REM so hand off to a copy that git will never touch.
REM Passing "%~dp0." instead of "%~dp0" avoids a trailing backslash right
REM before the closing quote.
if /i "%~n0"=="jobprep-launcher" goto :fromtemp
copy /y "%~f0" "%TEMP%\jobprep-launcher.bat" >nul 2>&1
if errorlevel 1 goto :inplace
call "%TEMP%\jobprep-launcher.bat" "%~dp0." %*
exit /b

:fromtemp
REM The app folder arrives as the first argument; shift so that the rest of
REM the script sees the original arguments at %1 either way.
REM No argument means this file was run directly rather than handed off, so
REM fall back to running in place.
if "%~1"=="" goto :inplace
cd /d "%~1"
shift
goto :aftercd

:inplace
cd /d "%~dp0"

:aftercd

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

REM Compare against the branch this one actually tracks. A remote branch that
REM merely shares the local name can be something else entirely, which would
REM report "up to date" forever.
set "UPSTREAM="
for /f "usebackq delims=" %%u in (`git rev-parse --abbrev-ref --symbolic-full-name @{u} 2^>nul`) do set "UPSTREAM=%%u"
if not defined UPSTREAM set "UPSTREAM=origin/!BRANCH!"

echo Checking GitHub for updates: !BRANCH! vs !UPSTREAM! ...
REM Fail fast instead of hanging on a credential prompt.
set "GIT_TERMINAL_PROMPT=0"
git fetch origin >nul 2>&1
if errorlevel 1 (
    echo Could not reach GitHub. Continuing with the local version.
    goto :afterupdate
)

set "BEHIND="
for /f "usebackq delims=" %%c in (`git rev-list --count HEAD..!UPSTREAM! 2^>nul`) do set "BEHIND=%%c"
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
git log --no-merges --pretty=format:"   - %%s" HEAD..!UPSTREAM!
echo.
echo.
echo   Files affected:
echo.
git diff --name-only HEAD !UPSTREAM!
echo.
echo ===============================================================
echo.

REM Untracked files are ignored on purpose: unrelated folders sitting in the
REM clone would otherwise block every update forever. Tracked edits are only
REM reported, not treated as fatal - git refuses a merge that would overwrite
REM them, so the user can safely decide.
set "DIRTY="
for /f "usebackq delims=" %%d in (`git status --porcelain -uno 2^>nul`) do set "DIRTY=1"
if defined DIRTY (
    echo   [WARNING] These tracked files have uncommitted edits:
    echo.
    git status --porcelain -uno
    echo.
    echo   Git will refuse the update if it would overwrite any of them.
    echo.
)

set "ANSWER="
set /p "ANSWER=Apply this update now? [y/N] "
if /i not "!ANSWER!"=="y" (
    echo Update skipped. Starting the current version.
    goto :afterupdate
)

echo.
echo Updating...
git merge --ff-only !UPSTREAM!
if errorlevel 1 (
    echo.
    echo [ERROR] Update failed. Starting the current version instead.
    echo.
    pause
    goto :afterupdate
)
echo Update complete.
REM This run keeps using the copy made before the update. If the update
REM changed the launcher itself, the new one takes effect next launch.
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

REM Compare the commit this build came from with the current one. Two quick
REM git calls, instead of spawning PowerShell to stat every source file --
REM that process startup was what made every launch slow.
set "HEADCOMMIT="
for /f "usebackq delims=" %%h in (`git rev-parse HEAD 2^>nul`) do set "HEADCOMMIT=%%h"
if not defined HEADCOMMIT goto :usebuild
if not exist ".next\.build-commit" goto :dobuild

set "BUILTCOMMIT="
set /p "BUILTCOMMIT="<".next\.build-commit"
if not "!HEADCOMMIT!"=="!BUILTCOMMIT!" goto :dobuild

REM Also catch edits made directly on this machine. Scoped to source paths so
REM that an edited README does not force a rebuild on every launch.
set "SRCDIRTY="
for /f "usebackq delims=" %%s in (`git status --porcelain -uno -- app components lib types package.json next.config.ts tsconfig.json 2^>nul`) do set "SRCDIRTY=1"
if defined SRCDIRTY goto :dobuild

:usebuild
echo Using the existing build.
goto :startserver

:dobuild
echo.
echo Building app. This may take a few minutes...
call npm run build
if errorlevel 1 goto :buildfail

REM Record which commit this build came from, so the next launch can tell
REM whether it is still current without scanning the source tree.
set "NOWCOMMIT="
for /f "usebackq delims=" %%h in (`git rev-parse HEAD 2^>nul`) do set "NOWCOMMIT=%%h"
if defined NOWCOMMIT >".next\.build-commit" echo !NOWCOMMIT!

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
