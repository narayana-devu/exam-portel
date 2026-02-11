@echo off
echo ================================
echo   Auto-Deploy with Version Bump
echo ================================
echo.

REM Bump version
echo [1/4] Bumping version...
node tools/bump_version.js
if %errorlevel% neq 0 (
    echo ERROR: Version bump failed!
    exit /b %errorlevel%
)
echo.

REM Stage all changes
echo [2/4] Staging changes...
git add -A
echo.

REM Get the new version
for /f "tokens=*" %%i in ('findstr /r "v[0-9][0-9]*" client\index.html') do set VERSION_LINE=%%i
for /f "tokens=2 delims=v" %%a in ('echo %VERSION_LINE%') do set VERSION=%%a

REM Commit with version message
echo [3/4] Committing changes...
set /p COMMIT_MSG="Enter commit message (or press Enter for default): "
if "%COMMIT_MSG%"=="" (
    git commit -m "v%VERSION%: Auto-deployment"
) else (
    git commit -m "v%VERSION%: %COMMIT_MSG%"
)
echo.

REM Push to GitHub
echo [4/4] Pushing to GitHub...
git push origin main
echo.

echo ================================
echo   ✅ Deployment Complete!
echo   Version: v%VERSION%
echo   URL: https://exam-portel.vercel.app/
echo ================================
