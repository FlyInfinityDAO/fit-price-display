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
