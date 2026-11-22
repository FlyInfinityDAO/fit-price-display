import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

test('health endpoint identifies the isolated Social API and sets strict CORS headers', async () => {
  const request = new Request('https://social.example/api/health', {
    headers: { Origin: 'https://flyinfinitydao.github.io' }
  });
  const response = await worker.fetch(request, { APP_ORIGIN: 'https://flyinfinitydao.github.io' });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://flyinfinitydao.github.io');
  assert.deepEqual(await response.json(), { ok: true, service: 'Fly Infinity Social API', version: '1.0.0' });
});

test('requests from an unapproved browser origin are rejected', async () => {
  const request = new Request('https://social.example/api/health', {
    headers: { Origin: 'https://malicious.example' }
  });
  const response = await worker.fetch(request, { APP_ORIGIN: 'https://flyinfinitydao.github.io' });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'Origin not allowed' });
});

test('unknown routes return a structured 404 without requiring D1 or R2', async () => {
  const request = new Request('https://social.example/api/not-a-route', {
    headers: { Origin: 'https://flyinfinitydao.github.io' }
  });
  const response = await worker.fetch(request, { APP_ORIGIN: 'https://flyinfinitydao.github.io' });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Not found' });
});

test('preflight returns the allowed methods and headers for the Social API', async () => {
  const request = new Request('https://social.example/api/posts', {
    method: 'OPTIONS',
    headers: { Origin: 'https://flyinfinitydao.github.io' }
  });
  const response = await worker.fetch(request, { APP_ORIGIN: 'https://flyinfinitydao.github.io' });
  assert.equal(response.status, 204);
  assert.match(response.headers.get('access-control-allow-methods'), /PUT/);
  assert.match(response.headers.get('access-control-allow-headers'), /Authorization/);
});
