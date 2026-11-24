/* Isolated, unauthenticated, read-only test bench for Owner Profile */
(() => {
  'use strict';
  const TARGET = '0xc8199B9A3408631a0defBfb7381b736f582Ce642';
  const NETWORK = '0x7f1cB4fce7cB3b6C612c4A7Dd123D3865640dC1B';
  const ZERO = '0x0000000000000000000000000000000000000000';
  const RPCS = [
    'https://bsc-rpc.publicnode.com',
    'https://bsc-dataseed.binance.org/',
    'https://1rpc.io/bnb'
  ];
  const NETWORK_ABI = [
    'function Owner_Exists(address owner) view returns (bool)',
    'function Owner_Left_Right_All(address owner) view returns (uint32,uint32)',
    'function Owner_Directs(address owner) view returns (address,address)',
    'function Fly_Infinity_Token_Contract() view returns (address)'
  ];
  const TOKEN_ABI = [
    'function Owner_Info_FIT(address user) view returns (uint256 purchased,uint256 allowedLimit,uint256 remaining)',
    'function balanceOf(address account) view returns (uint256)',
    'function Price() view returns (uint256)'
  ];
  const $ = id => document.getElementById(id);
  function shortAddress(address) {
    const value = String(address || '');
    return /^0x[0-9a-f]{40}$/i.test(value) ? value.slice(0, 3) + '...' + value.slice(-3) : value;
  }
  const state = {
    provider: null,
    rpc: '',
    network: null,
    token: null,
    tokenAddress: '',
    directCache: new Map(),
    expanded: new Set(),
    pending: new Map(),
    errors: new Map(),
    epoch: 0,
    testId: 0,
    rootPair: null,
    logs: []
  };

  function log(message, data) {
    const line = new Date().toISOString() + '  ' + message +
      (data === undefined ? '' : '  ' + JSON.stringify(data, (_, v) => v && v._isBigNumber ? v.toString() : v));
    state.logs.push(line);
    if (state.logs.length > 120) state.logs.shift();
    $('testLog').textContent = state.logs.join('\n');
  }

  function raw(name, value) {
    const lines = $('rawResults');
    if (lines.textContent === 'No contract responses yet.') lines.textContent = '';
    lines.textContent += (lines.textContent ? '\n\n' : '') + name + ':\n' + JSON.stringify(value, (_, v) => v && v._isBigNumber ? v.toString() : v, 2);
  }

  function addResult(name, status, detail = '') {
    const list = $('testResults');
    if (list.querySelector('.op-empty')) list.replaceChildren();
    let row = document.getElementById('test-' + name.replace(/[^a-z0-9]/gi,'-'));
    if (!row) {
      row = document.createElement('div');
      row.id = 'test-' + name.replace(/[^a-z0-9]/gi,'-');
      row.className = 'op-test-row';
      const icon = document.createElement('i');
      icon.className = status === 'ok' ? 'fa-solid fa-circle-check op-ok' : status === 'fail' ? 'fa-solid fa-circle-xmark op-fail' : 'fa-solid fa-circle-notch fa-spin op-pending';
      const wrap = document.createElement('div');
      const label = document.createElement('strong'); label.textContent = name;
      const note = document.createElement('div'); note.className = 'op-test-error';
      wrap.append(label,note); row.append(icon,wrap); list.appendChild(row);
    }
    row.firstElementChild.className = status === 'ok' ? 'fa-solid fa-circle-check op-ok' : status === 'fail' ? 'fa-solid fa-circle-xmark op-fail' : 'fa-solid fa-circle-notch fa-spin op-pending';
    row.lastElementChild.lastElementChild.textContent = detail;
  }

  function setMetric(id, value) { $(id).textContent = value; }
  function amount(value, decimals=4) {
    return Number(ethers.utils.formatUnits(value,18)).toLocaleString('en-US',{maximumFractionDigits:decimals});
  }
  function dollars(value, decimals=4) {
    const n=Number(value);
    return Number.isFinite(n)?'$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:decimals}):'—';
  }
  function norm(address) {
    return ethers.utils.getAddress(String(address).toLowerCase());
  }
  async function createProvider(url) {
    const provider = new ethers.providers.JsonRpcProvider(url,{name:'bnb',chainId:56});
    const network = await provider.getNetwork();
    if (Number(network.chainId)!==56) throw new Error('Expected BNB Chain 56, received '+network.chainId);
    const block = await provider.getBlockNumber();
    const code = await provider.getCode(norm(NETWORK));
    if (!code || code === '0x') throw new Error('No contract bytecode at configured Network address');
    return {provider,block,network,code};
  }
  async function connectRpc() {
    let last;
    for (const url of RPCS) {
      let result;
      try {
        result = await createProvider(url);
        state.provider = result.provider;
        state.rpc = url;
        state.network = new ethers.Contract(norm(NETWORK),NETWORK_ABI,state.provider);
        log('RPC connected',{url,chainId:result.network.chainId,block:result.block,networkCodeBytes:(result.code.length-2)/2});
        addResult('rpc','ok',url+' · chain 56 · block '+result.block);
        addResult('network-code','ok','Contract code found · '+((result.code.length-2)/2)+' bytes');
        return result;
      } catch (error) {
        last=error;
        try { if (result && result.provider) result.provider.destroy(); } catch {}
        log('RPC failed '+url,error.message||String(error));
        addResult('rpc-'+RPCS.indexOf(url),'fail',String(error.message||error).slice(0,180));
      }
    }
    throw last||new Error('No BNB Chain RPC endpoint responded');
  }

  async function runCall(label, fn) {
    addResult(label,'pending','Calling contract…');
    const start=performance.now();
    try {
      const value=await fn();
      const ms=Math.round(performance.now()-start);
      addResult(label,'ok','Success · '+ms+' ms');
      raw(label,value);
      log(label+' success',{durationMs:ms,result:value});
      return {ok:true,value};
    } catch(error) {
      const message=error && error.message ? error.message : String(error);
      addResult(label,'fail',message.slice(0,240));
      log(label+' FAILED',message);
      return {ok:false,error};
    }
  }

  async function copy(address) {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(address);
      else {
        const input=document.createElement('textarea');input.value=address;input.style.position='fixed';input.style.opacity='0';
        document.body.appendChild(input);input.select();const ok=document.execCommand('copy');input.remove();if(!ok)throw new Error('copy rejected');
      }
      $('testOverall').textContent='Copied: '+address;
    } catch(error) { $('testOverall').textContent='Copy failed: '+(error.message||error); }
  }

  function createNode(address, side, ancestors, depth, count) {
    count.value++;
    const card=document.createElement('div');
    const zero=address.toLowerCase()===ZERO.toLowerCase();
    card.className='op-tree-node'+(zero?' zero':'');
    const head=document.createElement('div');head.className='op-tree-node-head';
    const toggle=document.createElement('button');toggle.type='button';toggle.className='op-tree-toggle';
    toggle.textContent=zero?'·':(state.expanded.has(address.toLowerCase())?'−':'+');
    toggle.disabled=zero||depth>=14||count.value>=260;
    toggle.setAttribute('aria-label','Expand branch');
    const addr=document.createElement('div');addr.className='op-tree-address';addr.textContent=shortAddress(address);addr.title=address;addr.setAttribute('aria-label',address);
    const cp=document.createElement('button');cp.type='button';cp.className='op-tree-copy';cp.textContent='⧉';cp.title='Copy address';cp.addEventListener('click',()=>copy(address));
    head.append(toggle,addr,cp);card.appendChild(head);
    const label=document.createElement('div');label.className='op-tree-label';
    label.textContent=zero?'Empty side · zero address returned by contract':(side==='left'?'Left direct':'Right direct');card.appendChild(label);
    if(!zero) {
      const key=address.toLowerCase();
      toggle.addEventListener('click',async()=>{
        if(state.expanded.has(key)){state.expanded.delete(key);renderTree();return;}
        state.expanded.add(key);renderTree();
        try{await loadDirects(address);}catch(e){state.errors.set(key,e.message||String(e));renderTree();}
      });
      if(state.expanded.has(key)){
        const branch=document.createElement('div');branch.className='op-tree-branch';
        if(ancestors.has(key)){branch.textContent='Repeated address detected; branch stopped.';}
        else if(state.pending.has(key)){branch.className+=' op-tree-loading';branch.textContent='Loading direct branches…';}
        else if(state.errors.has(key)){
          branch.className+=' op-tree-loading';branch.textContent=state.errors.get(key);
          const retry=document.createElement('button');retry.type='button';retry.className='op-btn subtle';retry.textContent='Retry';
          retry.addEventListener('click',()=>{state.errors.delete(key);loadDirects(address).catch(()=>{});});
          branch.appendChild(retry);
        } else if(state.directCache.has(key)){
          const next=new Set(ancestors);next.add(key);
          branch.appendChild(createChildren(state.directCache.get(key),next,depth+1,count));
        }
        card.appendChild(branch);
      }
    }
    return card;
  }
  function createChildren(pair, ancestors, depth, count) {
    const grid=document.createElement('div');grid.className='op-tree-children';
    ['left','right'].forEach((side,i)=>{
      const col=document.createElement('div');col.className='op-tree-side '+side;
      const tag=document.createElement('div');tag.className='op-tree-side-label';tag.textContent=side.toUpperCase();col.appendChild(tag);
      const child=pair[i]||ZERO;
      if(child.toLowerCase()!==ZERO.toLowerCase() && ancestors.has(child.toLowerCase())){
        const repeated=document.createElement('div');repeated.className='op-tree-node zero';repeated.textContent=shortAddress(child)+' · repeated branch';repeated.title=child;
        col.appendChild(repeated);
      }else if(count.value<260) col.appendChild(createNode(child,side,ancestors,depth,count));
      else {const cap=document.createElement('div');cap.className='op-tree-node zero';cap.textContent='Display safety limit reached';col.appendChild(cap);}
      grid.appendChild(col);
    });
    return grid;
  }
  function renderTree() {
    const root=$('testTreeRoot');root.replaceChildren();
    if(!state.rootPair){root.textContent='Waiting for successful Owner_Directs call.';return;}
    const holder=document.createElement('div');holder.className='op-tree-root';
    const rootLabel=document.createElement('div');rootLabel.className='op-tree-root-label';
    rootLabel.textContent=shortAddress(TARGET);rootLabel.title=TARGET;rootLabel.setAttribute('aria-label',TARGET);
    const rootCopy=document.createElement('button');rootCopy.className='op-icon-btn';rootCopy.type='button';rootCopy.textContent='⧉';rootCopy.addEventListener('click',()=>copy(TARGET));rootLabel.appendChild(rootCopy);
    const count={value:0};
    holder.append(rootLabel,createChildren(state.rootPair,new Set([TARGET.toLowerCase()]),1,count));
    root.appendChild(holder);
  }
  async function loadDirects(address) {
    const key=address.toLowerCase();
    if(state.directCache.has(key))return state.directCache.get(key);
    if(state.pending.has(key))return state.pending.get(key);
    const epoch=state.epoch;
    const promise=state.network.Owner_Directs(address).then(pair=>{
      const value=[norm(pair[0]),norm(pair[1])];
      if(epoch===state.epoch)state.directCache.set(key,value);
      log('Owner_Directs expanded',{address,left:value[0],right:value[1]});
      return value;
    }).catch(error=>{
      if(epoch===state.epoch)state.errors.set(key,error.message||String(error));
      throw error;
    }).finally(()=>{
      state.pending.delete(key);
      if(epoch===state.epoch)renderTree();
    });
    state.pending.set(key,promise);renderTree();return promise;
  }

  async function runTests() {
    const run=++state.testId;
    $('runTests').disabled=true;$('refreshTests').disabled=true;
    $('testOverall').textContent='Connecting to public BNB Chain RPC…';
    $('testResults').replaceChildren();
    $('testLog').textContent='Starting read-only diagnostics…';
    $('rawResults').textContent='Waiting for contract calls…';
    ['vPurchased','vLimit','vRemaining','vBalance','vPrice','vValue','vOwner','vLeft','vRight','vToken'].forEach(id=>setMetric(id,'—'));
    state.rootPair=null;state.directCache.clear();state.expanded.clear();state.pending.clear();state.errors.clear();state.epoch++;
    renderTree();

    try {
      await connectRpc();
      if(run!==state.testId)return;
      const address=norm(TARGET);
      const results=await Promise.all([
        runCall('Owner_Exists',()=>state.network.Owner_Exists(address)),
        runCall('Owner_Left_Right_All',()=>state.network.Owner_Left_Right_All(address)),
        runCall('Owner_Directs',()=>state.network.Owner_Directs(address)),
        runCall('Fly_Infinity_Token_Contract',()=>state.network.Fly_Infinity_Token_Contract())
      ]);
      if(run!==state.testId)return;
      if(results[0].ok){setMetric('vOwner',results[0].value?'TRUE':'FALSE');if(!results[0].value)addResult('Owner_Exists','fail','Wallet is not currently an Owner according to the network contract.');}
      if(results[1].ok){setMetric('vLeft',Number(results[1].value[0]).toLocaleString('en-US'));setMetric('vRight',Number(results[1].value[1]).toLocaleString('en-US'));}
      if(results[2].ok){state.rootPair=[norm(results[2].value[0]),norm(results[2].value[1])];state.directCache.set(address.toLowerCase(),state.rootPair);renderTree();}
      if(!results[3].ok)throw results[3].error;
      state.tokenAddress=norm(results[3].value);setMetric('vToken',state.tokenAddress);
      addResult('token-code','pending','Checking FIT token bytecode…');
      const tokenCode=await state.provider.getCode(state.tokenAddress);
      if(!tokenCode||tokenCode==='0x')throw new Error('The token contract address has no code: '+state.tokenAddress);
      addResult('token-code','ok','FIT token contract exists · '+((tokenCode.length-2)/2)+' bytes');
      state.token=new ethers.Contract(state.tokenAddress,TOKEN_ABI,state.provider);

      const tokenResults=await Promise.all([
        runCall('Owner_Info_FIT',()=>state.token.Owner_Info_FIT(address)),
        runCall('balanceOf',()=>state.token.balanceOf(address)),
        runCall('Price',()=>state.token.Price())
      ]);
      if(tokenResults[0].ok){
        const x=tokenResults[0].value;
        setMetric('vPurchased','$'+amount(x.purchased??x[0]));
        setMetric('vLimit','$'+amount(x.allowedLimit??x[1]));
        setMetric('vRemaining','$'+amount(x.remaining??x[2]));
      }
      let balance=null,price=null;
      if(tokenResults[1].ok){balance=Number(ethers.utils.formatUnits(tokenResults[1].value,18));setMetric('vBalance',amount(tokenResults[1].value,6)+' FIT');}
      if(tokenResults[2].ok){price=Number(ethers.utils.formatUnits(tokenResults[2].value,18));setMetric('vPrice',dollars(price,6));}
      if(balance!==null&&price!==null)setMetric('vValue',dollars(balance*price,4));

      const success=Array.from($('testResults').querySelectorAll('.op-test-row .op-ok')).length;
      const failures=Array.from($('testResults').querySelectorAll('.op-test-row .op-fail')).length;
      $('testOverall').textContent='Live tests completed · '+success+' passed · '+failures+' failed. RPC: '+state.rpc;
      log('Test run completed',{passed:success,failed:failures,block:await state.provider.getBlockNumber()});
    } catch(error) {
      $('testOverall').textContent='Test run failed: '+(error.message||String(error));
      log('TEST RUN FAILED',error.message||String(error));
    } finally {
      if(run===state.testId){$('runTests').disabled=false;$('refreshTests').disabled=false;}
    }
  }

  async function reloadTree() {
    if(!state.provider||!state.network){$('testOverall').textContent='Run contract diagnostics first.';return;}
    state.epoch++;state.rootPair=null;state.directCache.clear();state.expanded.clear();state.pending.clear();state.errors.clear();
    renderTree();
    try {
      const pair=await state.network.Owner_Directs(norm(TARGET));
      state.rootPair=[norm(pair[0]),norm(pair[1])];
      state.directCache.set(norm(TARGET).toLowerCase(),state.rootPair);
      renderTree();log('Root genealogy refreshed',{left:state.rootPair[0],right:state.rootPair[1]});
    } catch(error) { $('testTreeRoot').textContent='Owner_Directs failed: '+(error.message||error); }
  }

  $('runTests').addEventListener('click',runTests);
  $('refreshTests').addEventListener('click',runTests);
  $('reloadTree').addEventListener('click',reloadTree);
  $('testAddress').textContent=shortAddress(TARGET);$('testAddress').title=TARGET;
  document.querySelectorAll('[data-copy-address]').forEach(button => button.addEventListener('click', () => copy(button.getAttribute('data-copy-address'))));
  log('Read-only test bench ready',{target:TARGET,network:NETWORK});
  runTests();
})();
