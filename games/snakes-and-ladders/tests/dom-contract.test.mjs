import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root=new URL("../",import.meta.url);
const html=readFileSync(new URL("index.html",root),"utf8");
const js=readFileSync(new URL("js/snakes.js",root),"utf8");
const css=readFileSync(new URL("css/snakes.css",root),"utf8");
const ids=new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]));

test("every JavaScript element lookup exists in the page",()=>{
 const refs=[...new Set([...js.matchAll(/\$\(["']([^"']+)["']\)/g)].map(m=>m[1]))];
 assert.deepEqual(refs.filter(id=>!ids.has(id)),[]);
});
test("all visibility toggles point to real DOM elements",()=>{
 const refs=[...new Set([...js.matchAll(/show\(["']([^"']+)["']/g)].map(m=>m[1]))];
 assert.deepEqual(refs.filter(id=>!ids.has(id)),[]);
});
test("records panel is outside the hidden game-mode grid",()=>{
 const start=html.indexOf('id="modePanel"'),end=html.indexOf('id="gamePanel"');
 assert.ok(start>=0&&end>start);
 assert.ok(!html.slice(start,end).includes('id="statsPanel"'));
 assert.ok(html.indexOf('id="statsPanel"')>end);
});
test("online waiting controls exist and have matching IDs",()=>{
 for(const id of ["gameControls","gameFootnote","copyRoomBtn","reconnectBtn","roomPlayersText","activeRoomCode","statsWallet"])assert.ok(ids.has(id),id);
});
test("Ludo active-player glow and shared glass treatment are present",()=>{
 assert.match(css,/ludoPlayerFramePulse/);
 assert.match(css,/Unified Fly Games glass system/);
});

test("page chrome includes the complete Ludo-aligned responsive shell",()=>{
 assert.match(css,/body\.fi-neon-ludo\s*\{[\s\S]*?background:#0F0F0F/);
 assert.match(css,/body\.fi-neon-ludo \.topbar\s*\{[\s\S]*?display:flex/);
 assert.match(css,/body\.fi-neon-ludo \.hero h1/);
 assert.match(css,/body\.fi-neon-ludo footer[\s\S]*?color:#D2DDF1/);
 assert.match(css,/#statsPanel|\.stats-panel/);
});
test("player bar adapts to the number of occupied seats",()=>{
 assert.match(js,/bar\.dataset\.count=String\(room\.playerCount\)/);
 assert.match(js,/playersBar"\)\.dataset\.count=String\(game\.players\.length\)/);
 assert.match(css,/players-bar\[data-count="2"\]/);
 assert.match(css,/players-bar\[data-count="3"\]/);
});
test("CPU mode does not expose a difficulty setting that the random-dice rules cannot honor",()=>{
 assert.doesNotMatch(html,/id="cpuDifficulty"/);
 assert.match(js,/start\(1,Number\(\$\("cpuCount"\)\.value\),"medium"\)/);
});

test("illustrated board renders SVG snakes, wooden ladders, colorful tiles and 3D tokens",()=>{
 assert.match(js,/function boardPoint\(square\)/);
 assert.match(js,/function drawBoardRoutes\(svg\)/);
 assert.match(js,/class:"board-routes"/);
 assert.match(js,/class:"board-snake"/);
 assert.match(js,/class:"board-ladder"/);
 assert.match(js,/tilePalette=/);
 assert.match(js,/className="token"/);
 assert.match(css,/\.fi-snakes \.board-routes/);
 assert.match(css,/\.fi-snakes \.board-snake/);
 assert.match(css,/\.fi-snakes \.board-ladder/);
 assert.match(css,/--token-color/);
});
test("visual board mapping preserves all 100 squares in serpentine order",()=>{
 assert.match(js,/logicalRow=Math\.floor\(\(square-1\)\/10\)/);
 assert.match(js,/logicalCol=logicalRow%2===0\?/);
 assert.match(js,/for\(let row=9;row>=0;row--\)/);
 assert.match(js,/n===1\?"START":"FINISH"/);
});

test("SVG route artwork aligns inside the grid without covering cell labels",()=>{
 assert.match(css,/--board-inner-gap/);
 assert.match(css,/\.board-routes\{inset:var\(--board-inner-gap\)/);
 assert.match(css,/\.square\{z-index:auto\}/);
 assert.match(css,/\.square-number[^\{]*\{z-index:4\}/);
});

test("redesigned board assets use the final cache version",()=>{
 assert.match(html,/snakes[.]css[?]v=fly-snakes-16/);
 assert.match(html,/snakes[.]js[?]v=fly-snakes-13/);
});

test("entry rule and vivid piece palette are wired through client and server",()=>{
 const engine=readFileSync(new URL("js/snakes-engine.js",root),"utf8");
 const rules=readFileSync(new URL("worker/src/rules.js",root),"utf8");
 assert.match(engine,/needSix=from===0&&value!==6/);
 assert.match(rules,/needSix=position===0&&value!==6/);
 assert.match(js,/lastAction\?\.needSix\?t\("needSix"\)/);
 assert.match(css,/saturate\(2\.2\)/);
 assert.match(css,/\.fi-snakes \.fi-game-language \.language-button/);
});

test("Ludo-style sequential movement animation and game sounds are wired",()=>{
 assert.match(js,/async function animateMove\(previous,next\)/);
 assert.match(js,/await animateMove\(previous,game\)/);
 assert.match(js,/onlineStateQueue=onlineStateQueue\.then\(async\(\)=>/);
 assert.match(js,/motionBusy\|\|game\.status/);
 assert.match(js,/function playDiceSound\(\)/);
 assert.match(js,/function playStepSound\(/);
 assert.match(css,/snakesDiceRoll/);
});


test("token motion preserves the same visible token between every square",()=>{
 assert.match(js,/function squareOffset\(board,token,square,baseRect\)/);
 assert.match(js,/token\.style\.transform=translateAt\(targetOffset\);animation\.cancel\(\)/);
 assert.match(js,/token\.style\.transform=translateAt\(toOffset\);route\.cancel\(\)/);
 assert.doesNotMatch(js,/function pointDelta\(/);
});
test("language popover uses the same fixed mobile menu behavior as Ludo",()=>{
 assert.match(css,/#languageMenu:not\(\.open\)\{display:none!important\}/);
 assert.match(css,/#languageMenu\.open\{[\s\S]*?position:fixed!important/);
 assert.match(css,/\.fi-game-language-select\{[\s\S]*?clip:rect\(0,0,0,0\)!important/);
 assert.match(html,/shared-language-menu\.js\?v=fly-snakes-13/);
});


test("mobile room-code focus restores only an unexpected scroll reset",()=>{
 const scroll=readFileSync(new URL("js/snakes-mobile-scroll.js",root),"utf8");
 assert.match(html,/snakes-mobile-scroll\.js\?v=fly-snakes-16/);
 assert.match(scroll,/getElementById\("roomCodeInput"\)/);
 assert.match(scroll,/document\.activeElement===input/);
 assert.match(scroll,/\["fa","ar"\]\.includes\(document\.documentElement\.lang\)/);
 assert.match(scroll,/savedScrollY<120/);
 assert.match(scroll,/window\.scrollTo\(0,savedScrollY\)/);
 assert.match(scroll,/visualViewport\.addEventListener\("resize"/);
 assert.match(scroll,/roomInputActive/);
});


test("Android room-code focus disables smooth scrolling and scroll anchoring like Hokm",()=>{
 const scroll=readFileSync(new URL("js/snakes-mobile-scroll.js",root),"utf8");
 assert.match(scroll,/if\(!\/Android\/i\.test\(navigator\.userAgent/);
 assert.match(scroll,/classList\.add\("fi-android-webview"\)/);
 assert.match(css,/scroll-behavior:auto!important/);
 assert.match(css,/overflow-anchor:none!important/);
 assert.match(css,/scroll-margin-block:16px/);
});


test("Android Persian RTL keeps document scroll axis stable like Hokm",()=>{
 assert.ok(css.includes("html.fi-android-webview body.fi-rtl{direction:ltr!important}"));
 assert.ok(css.includes("html.fi-android-webview body.fi-rtl .arena{direction:ltr!important}"));
 assert.ok(css.includes("html.fi-android-webview body.fi-rtl .arena>header,"));
 assert.ok(css.includes("html.fi-android-webview body.fi-rtl .room-join input{direction:ltr!important;text-align:center!important}"));
});
