import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root=new URL("../",import.meta.url);
const html=readFileSync(new URL("index.html",root),"utf8");
const js=readFileSync(new URL("js/snakes.js",root),"utf8");
const css=readFileSync(new URL("css/snakes.css",root),"utf8");
const ids=new Set([...html.matchAll(/\\bid=["']([^"']+)["']/g)].map(m=>m[1]));

test("every JavaScript element lookup exists in the page",()=>{
 const refs=[...new Set([...js.matchAll(/\\$\\(["']([^"']+)["']\\)/g)].map(m=>m[1]))];
 assert.deepEqual(refs.filter(id=>!ids.has(id)),[]);
});
test("all visibility toggles point to real DOM elements",()=>{
 const refs=[...new Set([...js.matchAll(/show\\(["']([^"']+)["']/g)].map(m=>m[1]))];
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
