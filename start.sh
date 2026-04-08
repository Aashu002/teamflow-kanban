#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "⚡ TeamFlow — Starting servers..."
echo ""

# Kill any existing processes on these ports
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
sleep 1

# Start API
cd "$ROOT/server"
node index.js > /tmp/teamflow-api.log 2>&1 &
API_PID=$!

# Start Vite
cd "$ROOT/client"
npm run dev > /tmp/teamflow-vite.log 2>&1 &
VITE_PID=$!

sleep 2

# Check API
if curl -sf http://localhost:3001/api/health > /dev/null; then
  echo "  ✅ API server   → http://localhost:3001"
else
  echo "  ❌ API failed — check /tmp/teamflow-api.log"
fi

# Check Vite
if curl -sf http://localhost:5173 > /dev/null 2>&1 || lsof -ti:5173 > /dev/null 2>&1; then
  echo "  ✅ Frontend     → http://localhost:5173"
else
  echo "  ❌ Frontend failed — check /tmp/teamflow-vite.log"
fi

echo ""
echo "  🌐 Open: http://localhost:5173"
echo ""
echo "  Logs: /tmp/teamflow-api.log  /tmp/teamflow-vite.log"
echo "  Press Ctrl+C to stop all servers."
echo ""

trap "kill $API_PID $VITE_PID 2>/dev/null; echo ''; echo 'Stopped.'; exit 0" EXIT INT TERM
wait
