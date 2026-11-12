#!/usr/bin/env bash
set -euo pipefail

# Cloudflare Pages build for the standalone Chess Arena site.
# Run from the repository root; publish only the game frontend and its shared wallet bridge.
rm -rf dist
mkdir -p dist/games/chess-arena/css dist/games/chess-arena/js dist/games/backgammon/css dist/games/backgammon/js dist/games/hokm/css dist/games/hokm/js dist/games/hokm/engine dist/games/ludo/css dist/games/ludo/js

cp games/chess-arena/index.html dist/games/chess-arena/index.html
cp games/chess-arena/css/chess-arena.css dist/games/chess-arena/css/chess-arena.css
cp games/chess-arena/js/chess-arena.js dist/games/chess-arena/js/chess-arena.js
cp games/chess-arena/js/language.js dist/games/chess-arena/js/language.js

# Publish the standalone Backgammon Arena frontend and its local rules engine.
cp games/backgammon/index.html dist/games/backgammon/index.html
cp games/backgammon/css/backgammon.css dist/games/backgammon/css/backgammon.css
cp games/backgammon/js/backgammon.js dist/games/backgammon/js/backgammon.js
cp games/backgammon/js/backgammon-engine.js dist/games/backgammon/js/backgammon-engine.js
# Publish the Games hub and existing Hokm frontend.\ncp games/index.html dist/games/index.html\ncp games/hokm/index.html dist/games/hokm/index.html\ncp games/hokm/css/hokm.css games/hokm/css/hokm-neon-theme.css dist/games/hokm/css/\ncp games/hokm/engine/hokm-engine.js dist/games/hokm/engine/hokm-engine.js\ncp games/hokm/js/hokm-wallet-bridge.js games/hokm/js/hokm.js games/hokm/js/hokm-play.js games/hokm/js/hokm-online.js games/hokm/js/hokm-android-scroll.js games/hokm/js/hokm-neon-ambient.js dist/games/hokm/js/\n\n# Publish Fly Ludo frontend and deterministic rules engine.
cp games/ludo/index.html dist/games/ludo/index.html
cp games/ludo/css/ludo.css dist/games/ludo/css/ludo.css
cp games/ludo/js/ludo.js dist/games/ludo/js/ludo.js
cp games/ludo/js/ludo-engine.js dist/games/ludo/js/ludo-engine.js

# Reuse the exact brand assets from the main Fly Infinity website.
cp logo.png background-desktop.png background-mobile.png dist/
cp walletconnect-bridge.js dist/walletconnect-bridge.js

# Shared game chrome and language/ambient scripts are referenced by both game pages
# via ../*. Copy them into dist/games so those URLs resolve in the standalone Pages build.
cp games/fi-neon-games.css games/shared-language-menu.js games/shared-neon-ambient.js dist/games/

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
test -s dist/games/backgammon/index.html
test -s dist/games/backgammon/js/backgammon-engine.js
test -s dist/games/index.html\ntest -s dist/games/hokm/index.html\ntest -s dist/games/hokm/js/hokm.js\ntest -s dist/games/ludo/index.html
test -s dist/games/ludo/js/ludo-engine.js
test -s dist/walletconnect-bridge.js
test -s dist/games/fi-neon-games.css
test -s dist/games/shared-language-menu.js
test -s dist/games/shared-neon-ambient.js
