@echo off
rem ==================================================================
rem  Open World 3D - one-click launcher (Windows)
rem  - rebuilds index1.html only if it is missing (needs Node.js)
rem  - starts a tiny local server so mouse capture + sound work
rem  - prefers Node.js, falls back to Python, then opens the file
rem  Nothing is installed or downloaded automatically.
rem ==================================================================
setlocal
title Open World 3D - Enhanced Edition
cd /d "%~dp0"

echo.
echo   ================================================
echo    OPEN WORLD 3D  -  ENHANCED EDITION  (launcher)
echo   ================================================
echo.

rem -- 1. index1.html ships with the repo; rebuild only if missing -----
if not exist "index1.html" (
  where node >nul 2>nul
  if errorlevel 1 (
    echo [X] index1.html is missing and Node.js was not found.
    echo     Re-download the project, or install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
  )
  echo [*] index1.html is missing - building it from source...
  node _build2\build.js
  if errorlevel 1 (
    echo [X] The build failed. See the messages above.
    echo.
    pause
    exit /b 1
  )
)

rem -- 2. pick the best available way to serve the game ----------------
where node >nul 2>nul
if not errorlevel 1 goto serve_node

python --version >nul 2>nul
if not errorlevel 1 goto serve_python

python3 --version >nul 2>nul
if not errorlevel 1 goto serve_python3

goto open_direct

:serve_node
echo [*] Node.js found - starting the local server on http://127.0.0.1:8123
call :open_browser_later
echo     The game opens in your browser in a moment.
echo     Keep this window open while you play - closing it stops the server.
echo.
node _build2\serve.js
goto the_end

:serve_python
echo [*] Python found - starting the local server on http://127.0.0.1:8123
call :open_browser_later
echo     The game opens in your browser in a moment.
echo     Keep this window open while you play - closing it stops the server.
echo.
python -m http.server 8123
goto the_end

:serve_python3
echo [*] Python found - starting the local server on http://127.0.0.1:8123
call :open_browser_later
echo     The game opens in your browser in a moment.
echo     Keep this window open while you play - closing it stops the server.
echo.
python3 -m http.server 8123
goto the_end

:open_direct
echo [i] Neither Node.js nor Python was found - opening index1.html directly.
echo     It works, but for the full experience (mouse capture and sound)
echo     install Node.js from https://nodejs.org and run play.bat again.
echo.
start "" "index1.html"

:the_end
endlocal
exit /b 0

rem -- helper: open the game 2 seconds from now (server needs a moment)
:open_browser_later
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:8123/index1.html'"
exit /b 0
