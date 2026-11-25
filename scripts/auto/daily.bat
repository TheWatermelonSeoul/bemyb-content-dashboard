@echo off
chcp 65001 >nul
rem 매일 자동 갱신: 최신 코드 받기 -> 수집 -> GitHub 업로드 (작업 스케줄러가 실행)
cd /d "%~dp0..\.."
set "GIT=git"
where git >nul 2>nul || set "GIT=C:\Program Files\Git\cmd\git.exe"
if not exist logs mkdir logs
set "LOG=logs\auto-sync.log"
echo ==== %date% %time% ==== >> "%LOG%"
"%GIT%" pull -q --rebase --autostash >> "%LOG%" 2>&1
call npm run posts:sync >> "%LOG%" 2>&1
call npm run ace:collect >> "%LOG%" 2>&1
call npm run imweb:collect >> "%LOG%" 2>&1
if exist .env.local call npm run meta:collect >> "%LOG%" 2>&1
if exist .secrets\kakao-state.json call npm run kakao:collect >> "%LOG%" 2>&1
"%GIT%" add data >> "%LOG%" 2>&1
"%GIT%" diff --cached --quiet
if %errorlevel%==0 (
  echo no changes >> "%LOG%"
  exit /b 0
)
"%GIT%" commit -q -m "자동 데이터 갱신 %date%" >> "%LOG%" 2>&1
"%GIT%" pull -q --rebase --autostash >> "%LOG%" 2>&1
"%GIT%" push -q >> "%LOG%" 2>&1
if errorlevel 1 (echo PUSH FAILED >> "%LOG%") else (echo uploaded >> "%LOG%")
