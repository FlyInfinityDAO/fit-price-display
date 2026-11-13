import test from "node:test";
import assert from "node:assert/strict";
import { LudoRoom } from "../src/ludo-room.js";
import { createGame } from "../../js/ludo-engine.js";

const host="0x1111111111111111111111111111111111111111";
const guest="0x2222222222222222222222222222222222222222";
function makeRoom(){
  const store=new Map(),sent=[],sockets=[{send:value=>sent.push(JSON.parse(value))}];
  let alarmAt=null;
  const ctx={
    storage:{
      get:async key=>store.get(key),
      put:async(key,value)=>store.set(key,structuredClone(value)),
      delete:async key=>store.delete(key),
      setAlarm:async timestamp=>{alarmAt=timestamp;},
      deleteAlarm:async()=>{alarmAt=null;},
      getAlarm:async()=>alarmAt
    },
    getWebSockets:()=>sockets,
    acceptWebSocket:()=>{}
  };
  const room=new LudoRoom(ctx,{});
  return {room,store,sent,sockets,get alarmAt(){return alarmAt;}};
}
const post=(path,wallet)=>new Request("https://ludo-room.internal"+path,{method:"POST",headers:{"x-ludo-wallet":wallet}});
test("new friend room reserves one host seat and leaves the remaining seats open",async()=>{
  const {room}=makeRoom(),response=await room.fetch(post("/create?code=ABC234&players=4&mode=friend",host));
  const data=await response.json();
  assert.equal(response.status,200);
  assert.deepEqual(data.room.players,[host,null,null,null]);
  assert.equal(data.room.status,"waiting");
  assert.equal(data.room.hostWallet,host);
});
test("legacy waiting rooms prefilled with the host wallet are repaired on read",async()=>{
  const legacy={code:"ABC234",playerCount:4,players:[host,host,host,host],hostWallet:host,mode:"friend",difficulty:null,state:null,status:"waiting",createdAt:Date.now(),statsRecorded:false};
  const store=new Map([["game",legacy]]);
  const ctx={storage:{get:async key=>store.get(key),put:async(key,value)=>store.set(key,structuredClone(value)),delete:async key=>store.delete(key)},getWebSockets:()=>[],acceptWebSocket:()=>{}};
  const room=new LudoRoom(ctx,{});
  const response=await room.fetch(new Request("https://ludo-room.internal/snapshot",{headers:{"x-ludo-wallet":host}}));
  const data=await response.json();
  assert.equal(response.status,200);
  assert.deepEqual(data.room.players,[host,null,null,null]);
  assert.equal(store.get("game").hostWallet,host);
});
test("legacy CPU rooms with duplicate wallet seats are repaired to one human plus CPUs",async()=>{
  const legacy={code:"ABC234",playerCount:4,players:[host,host,host],hostWallet:host,mode:"cpu",difficulty:"medium",state:createGame(4,3),status:"active",createdAt:Date.now(),statsRecorded:false};
  const store=new Map([["game",legacy]]);
  const ctx={storage:{get:async key=>store.get(key),put:async(key,value)=>store.set(key,structuredClone(value)),delete:async key=>store.delete(key)},getWebSockets:()=>[],acceptWebSocket:()=>{}};
  const room=new LudoRoom(ctx,{});
  const response=await room.fetch(new Request("https://ludo-room.internal/snapshot",{headers:{"x-ludo-wallet":host}}));
  const data=await response.json();
  assert.equal(response.status,200);
  assert.deepEqual(data.room.players,[host,null,null,null]);
  assert.deepEqual(data.room.state.players.map(p=>p.kind),["human","cpu","cpu","cpu"]);
});
test("legacy waiting rooms deduplicate multiple wallets and restore all open seats",async()=>{
  const legacy={code:"ABC234",playerCount:4,players:[host,host,guest,guest],hostWallet:host,mode:"friend",difficulty:null,state:null,status:"waiting",createdAt:Date.now(),statsRecorded:false};
  const store=new Map([["game",legacy]]);
  const ctx={storage:{get:async key=>store.get(key),put:async(key,value)=>store.set(key,structuredClone(value)),delete:async key=>store.delete(key)},getWebSockets:()=>[],acceptWebSocket:()=>{}};
  const room=new LudoRoom(ctx,{});
  const response=await room.fetch(new Request("https://ludo-room.internal/snapshot",{headers:{"x-ludo-wallet":host}}));
  const data=await response.json();
  assert.equal(response.status,200);
  assert.deepEqual(data.room.players,[host,guest,null,null]);
  assert.equal(data.room.playerCount,4);
});

test("joining a room fills one empty seat without duplicating the creator wallet",async()=>{
  const {room}=makeRoom();
  await room.fetch(post("/create?code=ABC234&players=4&mode=friend",host));
  const joined=await room.fetch(post("/join",guest)),data=await joined.json();
  assert.equal(joined.status,200);
  assert.deepEqual(data.room.players,[host,guest,null,null]);
  const duplicate=await room.fetch(post("/join",host)),duplicateData=await duplicate.json();
  assert.deepEqual(duplicateData.room.players,[host,guest,null,null]);
});
test("three distinct guests can fill a four-player room and the next join is rejected",async()=>{
  const {room}=makeRoom(),third="0x3333333333333333333333333333333333333333",fourth="0x4444444444444444444444444444444444444444",fifth="0x5555555555555555555555555555555555555555";
  await room.fetch(post("/create?code=ABC234&players=4&mode=friend",host));
  const one=await room.fetch(post("/join",guest));
  const two=await room.fetch(post("/join",third));
  const three=await room.fetch(post("/join",fourth));
  const full=await room.fetch(post("/join",fifth));
  assert.equal(one.status,200);assert.equal(two.status,200);assert.equal(three.status,200);
  assert.equal(full.status,409);
  const snapshot=await room.fetch(new Request("https://ludo-room.internal/snapshot",{headers:{"x-ludo-wallet":host}}));
  const data=await snapshot.json();
  assert.deepEqual(data.room.players,[host,guest,third,fourth]);
  assert.equal(data.room.status,"active");
  assert.equal(data.room.state.players.length,4);
});

test("only the host can fill remaining waiting seats with CPU players",async()=>{
  const {room}=makeRoom();
  await room.fetch(post("/create?code=ABC234&players=4&mode=friend",host));
  await room.fetch(post("/join",guest));
  const denied=await room.fetch(post("/fill-cpu?difficulty=hard",guest));
  assert.equal(denied.status,403);
  const started=await room.fetch(post("/fill-cpu?difficulty=hard",host)),data=await started.json();
  assert.equal(started.status,200);
  assert.equal(data.room.status,"active");
  assert.equal(data.room.mode,"mixed");
  assert.deepEqual(data.room.players,[host,guest,null,null]);
  assert.deepEqual(data.room.state.players.map(p=>p.kind),["human","human","cpu","cpu"]);
});
test("CPU room creates exactly one human seat for the connected wallet",async()=>{
  const {room}=makeRoom(),response=await room.fetch(post("/create?code=ABC234&players=4&mode=cpu&humans=3",host));
  const data=await response.json();
  assert.deepEqual(data.room.players,[host,null,null,null]);
  assert.deepEqual(data.room.state.players.map(p=>p.kind),["human","cpu","cpu","cpu"]);
});
test("CPU roll is broadcast before its move, then the turn passes after the move",async()=>{
  const {room,store,sent}=makeRoom(),state=createGame(2,1);
  state.turn=1;state.players[1].pieces[0]=0;
  const game={code:"ABC234",playerCount:2,players:[host,null],hostWallet:host,mode:"cpu",difficulty:"medium",state,status:"active",createdAt:Date.now(),statsRecorded:false};
  await room.save(game);await room.scheduleCpuTurn(game);
  const previous=Math.random;Math.random=()=>0;
  try{
    await room.alarm();
    assert.equal(store.get("game").state.dice,1);
    assert.equal(store.get("game").state.players[1].pieces[0],0);
    assert.equal(sent.at(-1).type,"cpu-roll");
    await room.alarm();
  }finally{Math.random=previous;}
  assert.equal(store.get("game").state.players[1].pieces[0],1);
  assert.equal(store.get("game").state.turn,0);
  assert.equal(store.get("game").state.dice,null);
  assert.equal(sent.at(-1).type,"cpu-move");
});

test("three CPU opponents roll and move sequentially in seat order",async()=>{
  const {room,store,sent}=makeRoom(),state=createGame(4,1);
  state.turn=1;
  for(let i=1;i<4;i++)state.players[i].pieces[0]=0;
  const game={code:"ABC234",playerCount:4,players:[host,null,null,null],hostWallet:host,mode:"cpu",difficulty:"medium",state,status:"active",createdAt:Date.now(),statsRecorded:false};
  await room.save(game);await room.scheduleCpuTurn(game);
  const previous=Math.random;Math.random=()=>0;
  try{
    for(let cpu=1;cpu<=3;cpu++){
      await room.alarm();
      assert.equal(store.get("game").state.turn,cpu);
      assert.equal(store.get("game").state.dice,1);
      assert.equal(sent.at(-1).type,"cpu-roll");
      assert.equal(store.get("game").state.players[cpu].pieces[0],0);
      await room.alarm();
      assert.equal(store.get("game").state.players[cpu].pieces[0],1);
      assert.equal(sent.at(-1).type,"cpu-move");
      assert.equal(store.get("game").state.turn,cpu===3?0:cpu+1);
    }
  }finally{Math.random=previous;}
});

test("CPU extra roll remains with the same CPU before advancing to the next seat",async()=>{
  const {room,store,sent}=makeRoom(),state=createGame(3,1);
  state.turn=1;state.players[1].pieces[0]=0;state.players[2].pieces[0]=0;
  const game={code:"ABC234",playerCount:3,players:[host,null,null],hostWallet:host,mode:"cpu",difficulty:"medium",state,status:"active",createdAt:Date.now(),statsRecorded:false};
  await room.save(game);await room.scheduleCpuTurn(game);
  const previous=Math.random,rolls=[0.99,0];
  Math.random=()=>rolls.shift()??0;
  try{
    await room.alarm();assert.equal(store.get("game").state.dice,6);assert.equal(sent.at(-1).type,"cpu-roll");
    await room.alarm();assert.equal(store.get("game").state.turn,1);assert.equal(sent.at(-1).type,"cpu-move");
    await room.alarm();assert.equal(store.get("game").state.turn,1);assert.equal(sent.at(-1).type,"cpu-roll");
    await room.alarm();assert.equal(store.get("game").state.turn,2);
  }finally{Math.random=previous;}
});

test("concurrent joins are serialized and cannot overfill a room",async()=>{
  const {room}=makeRoom(),third="0x3333333333333333333333333333333333333333",fourth="0x4444444444444444444444444444444444444444",fifth="0x5555555555555555555555555555555555555555";
  await room.fetch(post("/create?code=ABC234&players=4&mode=friend",host));
  const results=await Promise.all([guest,third,fourth,fifth].map(wallet=>room.fetch(post("/join",wallet))));
  assert.equal(results.filter(r=>r.status===200).length,3);
  assert.equal(results.filter(r=>r.status===409).length,1);
  const snapshot=await room.fetch(new Request("https://ludo-room.internal/snapshot",{headers:{"x-ludo-wallet":host}}));
  const data=await snapshot.json();
  assert.equal(data.room.players.filter(Boolean).length,4);
  assert.equal(new Set(data.room.players).size,4);
});

test("an API resignation cannot manufacture a winner or award FIGS",async()=>{
  const store=new Map([["game",{code:"ABC234",playerCount:2,players:[host,guest],hostWallet:host,mode:"friend",difficulty:null,state:createGame(2,2),status:"active",createdAt:Date.now(),statsRecorded:false}]]);
  const ctx={storage:{get:async key=>store.get(key),put:async(key,value)=>store.set(key,structuredClone(value)),delete:async key=>store.delete(key)},getWebSockets:()=>[],acceptWebSocket:()=>{}};
  const room=new LudoRoom(ctx,{});
  const sent=[];
  const socket={deserializeAttachment:()=>({wallet:host}),send:value=>sent.push(JSON.parse(value))};
  await room.webSocketMessage(socket,JSON.stringify({type:"resign"}));
  assert.equal(store.get("game").status,"active");
  assert.equal(store.get("game").state.status,"active");
  assert.equal(store.get("game").statsRecorded,false);
  assert.equal(sent[0].type,"error");
});
