/* Public frontend configuration. This file must never contain API secrets. */
window.FLY_AI_CONFIG = Object.freeze({
  // Cloudflare Worker production API origin. Never place API keys in frontend code.
  apiBase: 'https://fly-ai-api.flyinfinityplatform.workers.dev'
});
