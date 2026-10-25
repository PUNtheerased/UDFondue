@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo  UDFondue - Push to GitHub
echo ========================================
echo.

git status
echo.

set /p MSG=Commit message (ว่าง = update): 
if "%MSG%"=="" set MSG=update

git add -A
git status --short
echo.

git diff --cached --quiet
if %ERRORLEVEL%==0 (
  echo ไม่มีไฟล์ให้ commit
) else (
  git commit -m "%MSG%"
  if errorlevel 1 (
    echo Commit ไม่สำเร็จ
    pause
    exit /b 1
  )
)

echo.
echo กำลัง push ไป origin...
git push origin HEAD
if errorlevel 1 (
  echo Push ไม่สำเร็จ
  pause
  exit /b 1
)

echo.
echo เสร็จแล้ว
git status
echo.
pause
