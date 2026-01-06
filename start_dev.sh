#!/bin/bash

# SweetTeams Start Script
# Starts both Backend and Frontend and logs output to files.

echo "🚀 Starting SweetTeams..."

# Create log files if they don't exist
touch server/backend.log
touch client/frontend.log

# Kill existing node processes (optional, be careful)
# pkill -f "node"

# 1. Start Backend
echo "Starting Backend Server..."
cd server
npm start > backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend running (PID: $BACKEND_PID), logging to server/backend.log"
cd ..

# Wait a bit for backend to initialize
sleep 2

# 2. Start Frontend
echo "Starting Frontend Client..."
cd client
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend running (PID: $FRONTEND_PID), logging to client/frontend.log"
cd ..

echo "✅ Both services started!"
echo "---------------------------------------------------"
echo "Backend Logs:  tail -f server/backend.log"
echo "Frontend Logs: tail -f client/frontend.log"
echo "---------------------------------------------------"
echo "Press Ctrl+C to stop both servers."

# Trap Ctrl+C to kill background processes
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT

# Keep script running
wait
