#!/usr/bin/env bash
set -euo pipefail

# Cloudflare Pages build for the standalone Chess Arena site.
# Run from the repository root; publish only the game frontend and its shared wallet bridge.
rm -rf dist
mkdir -p dist/games/chess-arena/css dist/games/chess-arena/js

cp games/chess-arena/index.html dist/games/chess-arena/index.html
cp games/chess-arena/css/chess-arena.css dist/games/chess-arena/css/chess-arena.css
cp games/chess-arena/js/chess-arena.js dist/games/chess-arena/js/chess-arena.js
cp walletconnect-bridge.js dist/walletconnect-bridge.js

cat > dist/index.html <<'HTML'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="refresh" content="0;url=/games/chess-arena/">
  <title>Fly Infinity Chess Arena</title>
  <link rel="canonical" href="/games/chess-arena/">
</head>
<body>
  <p><a href="/games/chess-arena/">Open Fly Infinity Chess Arena</a></p>
</body>
</html>
HTML

test -s dist/games/chess-arena/index.html
test -s dist/walletconnect-bridge.js
