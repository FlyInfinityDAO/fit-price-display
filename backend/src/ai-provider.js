/* Provider adapter: credentials stay in Worker secrets. Supports OpenAI-compatible APIs
   (including compatible hosted providers) and Google's Gemini generateContent API. */
export async function generateReply({messages,env,system,maxTokens:requestedMaxTokens}) {
  if (!env.AI_API_KEY || !env.AI_MODEL) throw new Error('AI provider is not configured');
  const provider=(env.AI_PROVIDER||'openai-compatible').toLowerCase();
  const configuredMaxTokens=Number(env.MAX_OUTPUT_TOKENS||1200);
  const maxTokens=Number.isFinite(requestedMaxTokens)?Math.max(1,Math.min(configuredMaxTokens,Math.floor(requestedMaxTokens))):configuredMaxTokens;
  if(provider==='gemini'){
    const contents=messages.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]}));
    const url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(env.AI_MODEL)+':generateContent?key='+encodeURIComponent(env.AI_API_KEY);
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents,generationConfig:{maxOutputTokens:maxTokens,temperature:0.4}})});
    if(!response.ok){console.error('Gemini provider error',response.status,(await response.text()).slice(0,400));throw new Error('AI provider temporarily unavailable')}
    const data=await response.json();return data.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
  }
  const base=(env.AI_BASE_URL||'https://api.openai.com/v1').replace(/\/$/,'');
  const response=await fetch(base+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+env.AI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:env.AI_MODEL,messages:[{role:'system',content:system},...messages],max_tokens:maxTokens,temperature:0.4})});
  if(!response.ok){console.error('AI provider error',response.status,(await response.text()).slice(0,400));throw new Error('AI provider temporarily unavailable')}
  const data=await response.json();return data.choices?.[0]?.message?.content||'';
}