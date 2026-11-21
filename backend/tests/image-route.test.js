import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

test('production image generation is disabled unless explicitly enabled', async () => {
  const response = await worker.fetch(
    new Request('https://fly-ai-api.example/api/image/generate', {
      method: 'POST',
      headers: {
        Origin: 'https://flyinfinitydao.github.io',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt: 'A premium product photo of a watch' })
    }),
    {
      APP_ORIGIN: 'https://flyinfinitydao.github.io',
      IMAGE_GENERATION_ENABLED: 'false'
    },
    {}
  );

  assert.equal(response.status, 404);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://flyinfinitydao.github.io');
  const data = await response.json();
  assert.equal(data.error, 'Not found');
});

test('image response quota headers are exposed to the browser', async () => {
  const response = await worker.fetch(
    new Request('https://fly-ai-api.example/api/health', {
      headers: { Origin: 'https://flyinfinitydao.github.io' }
    }),
    { APP_ORIGIN: 'https://flyinfinitydao.github.io' },
    {}
  );

  assert.equal(response.status, 200);
  const exposed = response.headers.get('Access-Control-Expose-Headers') || '';
  for (const name of [
    'X-Image-Model',
    'X-Image-Width',
    'X-Image-Height',
    'X-Image-Quota-Remaining',
    'X-Image-Global-Quota-Remaining',
    'X-Image-Seed'
  ]) {
    assert.ok(exposed.split(',').map(value => value.trim()).includes(name), name + ' should be exposed');
  }
});
