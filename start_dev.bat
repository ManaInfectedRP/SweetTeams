@echo off
echo 🚀 Starting SweetTeams...

echo Starting Backend (logging to server/backend.log)...
cd server
start /B npm start > backend.log 2>&1
cd ..

timeout /t 2 /nobreak >nul

echo Starting Frontend (logging to client/frontend.log)...
cd client
start /B npm run dev > frontend.log 2>&1
cd ..

echo.
echo ✅ Services started in background!
echo Logs: server/backend.log & client/frontend.log
echo.
echo Note: To stop servers, close this window or kill node processes manually.
pause
