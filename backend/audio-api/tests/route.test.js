import test from 'node:test';
import assert from 'node:assert/strict';
import audioWorker from '../src/index.js';

const origin = 'https://flyinfinitydao.github.io';
function request(path, options = {}) {
  return new Request('https://audio-worker.test' + path, {
    method: options.method || 'POST',
    headers: { Origin: options.origin || origin, 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body === undefined ? JSON.stringify({ text: 'A short voice test.' }) : options.body
  });
}

test('production audio speech endpoint is disabled to prevent API charges', async () => {
  const response = await audioWorker.fetch(request('/api/audio/tts'), {
    APP_ORIGIN: origin, AUDIO_PREVIEW_ENABLED: 'false'
  });
  assert.equal(response.status, 410);
  assert.match((await response.json()).error, /browser-native speech/i);
});

test('the no-wallet cloud preview endpoint is permanently disabled', async () => {
  const response = await audioWorker.fetch(request('/api/audio/preview'), {
    APP_ORIGIN: origin, AUDIO_PREVIEW_ENABLED: 'false'
  });
  assert.equal(response.status, 410);
});


test('no-wallet cloud preview stays disabled even if a legacy flag is enabled', async () => {
  const response = await audioWorker.fetch(request('/api/audio/preview'), {
    APP_ORIGIN: origin, AUDIO_PREVIEW_ENABLED: 'true'
  });
  assert.equal(response.status, 410);
});

test('the preview endpoint rejects any non-allowlisted origin', async () => {
  const response = await audioWorker.fetch(request('/api/audio/preview', { origin: 'https://not-allowed.example' }), {
    APP_ORIGIN: origin, AUDIO_PREVIEW_ENABLED: 'true'
  });
  assert.equal(response.status, 403);
});

test('AI music endpoint is explicitly disabled without paid provider approval', async () => {
  const response = await audioWorker.fetch(request('/api/audio/music'), {
    APP_ORIGIN: origin, AUDIO_PREVIEW_ENABLED: 'false'
  });
  assert.equal(response.status, 402);
  assert.match((await response.json()).error, /paid provider/i);
});

test('Gemini TTS proxy is disabled on the production Audio Worker by default', async () => {
  const response = await audioWorker.fetch(request('/api/audio/gemini-tts'), {
    APP_ORIGIN: origin
  });
  assert.equal(response.status, 404);
  assert.match((await response.json()).error, /not enabled/i);
});

test('Gemini TTS proxy validates the API key before contacting Google', async () => {
  const response = await audioWorker.fetch(request('/api/audio/gemini-tts', {
    body: JSON.stringify({ text: 'سلام', locale: 'fa-IR', voiceName: 'Sulafat' })
  }), {
    APP_ORIGIN: origin,
    GEMINI_TTS_PROXY_ENABLED: 'true'
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Google AI Studio API key/i);
});

test('Gemini TTS proxy rejects unsupported languages and voices', async () => {
  const env = { APP_ORIGIN: origin, GEMINI_TTS_PROXY_ENABLED: 'true' };
  const languageResponse = await audioWorker.fetch(request('/api/audio/gemini-tts', {
    body: JSON.stringify({ apiKey: 'test-api-key-123', text: 'hello', locale: 'xx-XX', voiceName: 'Sulafat' })
  }), env);
  assert.equal(languageResponse.status, 400);
  assert.match((await languageResponse.json()).error, /language/i);

  const voiceResponse = await audioWorker.fetch(request('/api/audio/gemini-tts', {
    body: JSON.stringify({ apiKey: 'test-api-key-123', text: 'hello', locale: 'en-US', voiceName: 'Unknown' })
  }), env);
  assert.equal(voiceResponse.status, 400);
  assert.match((await voiceResponse.json()).error, /voice/i);
});

test('Gemini TTS proxy supports GitHub Pages CORS preflight', async () => {
  const response = await audioWorker.fetch(new Request('https://audio-worker.test/api/audio/gemini-tts', {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type'
    }
  }), { APP_ORIGIN: origin, GEMINI_TTS_PROXY_ENABLED: 'true' });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.match(response.headers.get('Access-Control-Allow-Headers'), /Content-Type/i);
});
