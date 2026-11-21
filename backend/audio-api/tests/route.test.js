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

test('production audio speech endpoint rejects requests without an audio wallet session', async () => {
  const response = await audioWorker.fetch(request('/api/audio/tts'), {
    APP_ORIGIN: origin, AUDIO_PREVIEW_ENABLED: 'false'
  });
  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /wallet session/i);
});

test('the no-wallet preview endpoint is disabled by default', async () => {
  const response = await audioWorker.fetch(request('/api/audio/preview'), {
    APP_ORIGIN: origin, AUDIO_PREVIEW_ENABLED: 'false'
  });
  assert.equal(response.status, 404);
});


test('no-wallet preview remains unavailable on the production site origin even when enabled', async () => {
  const response = await audioWorker.fetch(request('/api/audio/preview'), {
    APP_ORIGIN: origin, AUDIO_PREVIEW_ENABLED: 'true'
  });
  assert.equal(response.status, 404);
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
