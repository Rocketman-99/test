@echo off
title 취준 도우미
cd /d "%~dp0"

if not exist ".next" (
    echo 첫 실행입니다. 앱을 빌드합니다. 시간이 걸릴 수 있어요...
    call npm install
    call npm run build
    if errorlevel 1 (
        echo [오류] 빌드에 실패했습니다.
        pause
        exit /b 1
    )
)

echo 서버를 시작합니다...
start "" "http://localhost:3000"
npm run start
