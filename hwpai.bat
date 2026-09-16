@echo off
chcp 65001 >nul
title hwp+AI Editor Standalone Launcher
cd /d "%~dp0"

echo ===================================================
echo   📄 hwp+AI Editor — 로컬 Standalone 앱 실행 중...
echo ===================================================

if exist server-port.txt del /f /q server-port.txt

if not exist "dist\index.html" (
    if not exist "node_modules\" (
        echo [안내] 의존성 패키지를 설치합니다...
        call npm install
        if errorlevel 1 goto BUILD_FAILED
    )
    echo [안내] 최신 정적 파일 빌드를 진행합니다...
    call npm run build
    if errorlevel 1 goto BUILD_FAILED
)

rem 빌드 결과물이 없으면 서버가 dist\index.html 을 읽지 못해 "500 Internal Server Error: ENOENT" 가 뜬다.
if not exist "dist\index.html" goto BUILD_FAILED

start "hwpai-server" /min node server.mjs

set COUNT=0
:WAIT_PORT
timeout /t 1 /nobreak >nul
set /a COUNT+=1
if exist server-port.txt goto GOT_PORT
if %COUNT% lss 10 goto WAIT_PORT

:GOT_PORT
set PORT=7700
if exist server-port.txt set /p PORT=<server-port.txt

echo [안내] http://127.0.0.1:%PORT% 연결 완료!

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://127.0.0.1:%PORT%
    exit /b 0
)

if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files\Microsoft\Edge\Application\msedge.exe" --app=http://127.0.0.1:%PORT%
    exit /b 0
)

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://127.0.0.1:%PORT%
    exit /b 0
)

if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --app=http://127.0.0.1:%PORT%
    exit /b 0
)

start http://127.0.0.1:%PORT%
exit /b 0

:BUILD_FAILED
echo [오류] 빌드에 실패했습니다. 위 메시지를 확인한 뒤 "npm install" 과 "npm run build" 를 직접 실행해 보세요.
pause
exit /b 1
