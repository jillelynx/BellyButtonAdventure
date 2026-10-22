#!/bin/bash
# Double-click this file to play Belly Button Adventure on this Mac.
# It starts a tiny web server (a small program that hands the game files
# to your browser) and opens the game. Close this window to stop it.
cd "$(dirname "$0")"
PORT=8765
for P in 8765 8766 8767 8768 8769; do
  if ! lsof -i :$P >/dev/null 2>&1; then PORT=$P; break; fi
done
echo ""
echo "  Belly Button Adventure is starting..."
echo "  Your browser will open in a moment."
echo "  (Leave this window open while you play. Close it when you're done.)"
echo ""
( sleep 1; open "http://localhost:$PORT/" ) &
python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1
