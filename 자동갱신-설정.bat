@echo off
chcp 65001 >nul
rem 처음 한 번만 실행: Git 설치 확인 -> GitHub 저장소 연결 -> 첫 업로드(GitHub 로그인) -> 매일 09:30 예약
cd /d "%~dp0"
set "GIT=git"
where git >nul 2>nul && goto hasgit
if exist "C:\Program Files\Git\cmd\git.exe" goto setgit
echo [1/4] Git 설치 중... (설치 허용 창이 뜨면 '예'를 누르세요)
winget install --id Git.Git -e --source winget --silent --accept-package-agreements --accept-source-agreements
:setgit
set "GIT=C:\Program Files\Git\cmd\git.exe"
if not exist "%GIT%" (
  echo Git 설치에 실패했습니다. https://git-scm.com 에서 설치한 뒤 이 파일을 다시 실행하세요.
  pause
  exit /b 1
)
:hasgit
echo [2/4] GitHub 저장소 연결 중...
if not exist ".git" (
  "%GIT%" init -q -b main
  "%GIT%" remote add origin https://github.com/TheWatermelonSeoul/bemyb-content-dashboard.git
)
"%GIT%" config user.name "bemyb-dashboard-bot"
"%GIT%" config user.email "bemyb-dashboard-bot@users.noreply.github.com"
"%GIT%" fetch -q origin main || goto fail
"%GIT%" reset -q --hard origin/main || goto fail
"%GIT%" branch -q --set-upstream-to=origin/main main
echo [3/4] 첫 수집과 업로드 (GitHub 로그인 창이 뜨면 로그인하세요)
call "%~dp0scripts\auto\daily.bat"
type logs\auto-sync.log | findstr /c:"PUSH FAILED" >nul && goto fail
echo [4/4] 매일 자동 실행 등록 중...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\auto\register-task.ps1" || goto fail
echo.
echo 설정 완료. 매일 09:30에 자동으로 수집하고 대시보드에 올립니다.
echo 기록: logs\auto-sync.log
pause
exit /b 0
:fail
echo.
echo 중간에 문제가 생겼습니다. 이 창을 캡처해서 Claude에게 보여주세요.
pause
exit /b 1
