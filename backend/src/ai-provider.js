/* Provider adapter: credentials stay in Worker secrets. Supports OpenAI-compatible APIs
   (including compatible hosted providers) and Google's Gemini generateContent API. */

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504, 529]);
const MAX_ATTEMPTS = 3;

async function fetchProvider(url, options, providerName) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response;
    try {
      response = await fetch(url, options);
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        console.error(providerName + ' network error after retries', String(error?.message || error).slice(0, 300));
        throw new Error('AI provider temporarily unavailable');
      }
      const delay = 500 * (2 ** (attempt - 1));
      console.warn(providerName + ' network error; retrying', { attempt, nextAttempt: attempt + 1, delayMs: delay });
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }

    if (response.ok) return response;

    const status = response.status;
    const detail = (await response.text()).slice(0, 400);
    if (!RETRYABLE_STATUS.has(status) || attempt === MAX_ATTEMPTS) {
      console.error(providerName + ' provider error', status, detail, { attempts: attempt });
      throw new Error('AI provider temporarily unavailable');
    }

    const retryAfter = Number(response.headers.get('Retry-After'));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(2500, Math.max(250, retryAfter * 1000))
      : 500 * (2 ** (attempt - 1));
    console.warn(providerName + ' provider returned a temporary error; retrying', {
      status,
      providerCode: (() => { try { return JSON.parse(detail)?.error?.code || null; } catch { return null; } })(),
      attempt,
      nextAttempt: attempt + 1,
      delayMs: delay
    });
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  throw new Error('AI provider temporarily unavailable');
}

export async function generateReply({messages,env,system,maxTokens:requestedMaxTokens}) {
  if (!env.AI_API_KEY || !env.AI_MODEL) throw new Error('AI provider is not configured');
  const provider=(env.AI_PROVIDER||'openai-compatible').toLowerCase();
  const configuredMaxTokens=Number(env.MAX_OUTPUT_TOKENS||1200);
  const maxTokens=Number.isFinite(requestedMaxTokens)?Math.max(1,Math.min(configuredMaxTokens,Math.floor(requestedMaxTokens))):configuredMaxTokens;
  if(provider==='gemini'){
    const contents=messages.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]}));
    const url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(env.AI_MODEL)+':generateContent?key='+encodeURIComponent(env.AI_API_KEY);
    const response=await fetchProvider(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents,generationConfig:{maxOutputTokens:maxTokens,temperature:0.4}})},'Gemini');
    const data=await response.json();return data.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
  }
  const base=(env.AI_BASE_URL||'https://api.openai.com/v1').replace(/\/$/,'');
  const response=await fetchProvider(base+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+env.AI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:env.AI_MODEL,messages:[{role:'system',content:system},...messages],max_tokens:maxTokens,temperature:0.4})},'AI');
  const data=await response.json();return data.choices?.[0]?.message?.content||'';
}
