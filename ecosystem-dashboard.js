(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = (value, lang) => new Intl.NumberFormat(lang || 'en-US', {minimumFractionDigits:2, maximumFractionDigits:6}).format(value);
  async function loadEcoHistory(){
    try{
      const response = await fetch('price-history.json?eco=' + Date.now(), {cache:'no-store'});
      if(!response.ok) throw new Error('history unavailable');
      const payload = await response.json();
      const records = Array.isArray(payload.records) ? payload.records.filter(x=>Number.isFinite(Number(x.price)) && x.date).sort((a,b)=>a.date.localeCompare(b.date)) : [];
      if(records.length < 2) throw new Error('not enough history records');
      const lang = (localStorage.getItem('fit_lang') || document.documentElement.lang || 'en');
      const prices = records.map(x=>Number(x.price));
      const drops = records.slice(1).reduce((n,row,i)=>n + (Number(row.price) < prices[i] ? 1 : 0),0);
      if($('ecoHistoryStart')) $('ecoHistoryStart').textContent = '$' + fmt(prices[0],lang);
      if($('ecoHistoryLatest')) $('ecoHistoryLatest').textContent = '$' + fmt(prices[prices.length-1],lang);
      if($('ecoHistoryCount')) $('ecoHistoryCount').textContent = fmt(records.length,lang);
      if($('ecoHistoryDrops')) $('ecoHistoryDrops').textContent = fmt(drops,lang);
      const min = Math.min(...prices), max = Math.max(...prices), range = (max-min)||1;
      const w=900,h=120,pad=7;
      const points=prices.map((v,i)=>({x:pad+(i/(prices.length-1))*(w-pad*2),y:h-pad-((v-min)/range)*(h-pad*2)}));
      const d=points.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+' '+p.y.toFixed(2)).join(' ');
      if($('ecoHistoryPath')) $('ecoHistoryPath').setAttribute('d',d);
      if($('ecoHistoryArea')) $('ecoHistoryArea').setAttribute('d',d+' L '+(w-pad)+' '+(h-pad)+' L '+pad+' '+(h-pad)+' Z');
      if($('ecoHistoryDot')){$('ecoHistoryDot').setAttribute('cx',points[points.length-1].x);$('ecoHistoryDot').setAttribute('cy',points[points.length-1].y);}
    }catch(error){
      ['ecoHistoryStart','ecoHistoryLatest','ecoHistoryCount','ecoHistoryDrops'].forEach(id=>{if($(id)) $(id).textContent='—';});
      if($('ecoHistoryPath')) $('ecoHistoryPath').setAttribute('d','');
      if($('ecoHistoryArea')) $('ecoHistoryArea').setAttribute('d','');
      console.warn('Fly Infinity historical summary unavailable:',error);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',loadEcoHistory); else loadEcoHistory();
})();
