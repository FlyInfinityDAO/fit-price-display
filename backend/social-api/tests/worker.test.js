import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { extractBearerToken } from '../src/index.js';

test('Bearer session tokens are extracted from standard Authorization headers', () => {
  const token = 'a'.repeat(64);
  assert.equal(extractBearerToken('Bearer ' + token), token);
  assert.equal(extractBearerToken('bearer ' + token), token);
  assert.equal(extractBearerToken('  ' + 'Bearer ' + token), '');
  assert.equal(extractBearerToken(null), '');
  assert.equal(extractBearerToken(''), '');
});

test('health endpoint identifies Social API v2 and sets strict CORS headers', async () => {
  const request = new Request('https://social.example/api/health', {
    headers: { Origin: 'https://flyinfinitydao.github.io' }
  });
  const response = await worker.fetch(request, { APP_ORIGIN: 'https://flyinfinitydao.github.io' });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://flyinfinitydao.github.io');
  assert.deepEqual(await response.json(), { ok: true, service: 'Fly Infinity Social API', version: '2.0.0' });
});

test('requests from an unapproved browser origin are rejected', async () => {
  const request = new Request('https://social.example/api/health', {
    headers: { Origin: 'https://malicious.example' }
  });
  const response = await worker.fetch(request, { APP_ORIGIN: 'https://flyinfinitydao.github.io' });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'Origin not allowed' });
});

test('old audio, challenge, profile listing and comment-style routes are no longer exposed', async () => {
  const paths = [
    '/api/challenges',
    '/api/creators',
    '/api/prompts',
    '/api/posts/example/comment'
  ];
  for (const path of paths) {
    const response = await worker.fetch(new Request('https://social.example' + path, {
      headers: { Origin: 'https://flyinfinitydao.github.io' }
    }), { APP_ORIGIN: 'https://flyinfinitydao.github.io' });
    assert.equal(response.status, 404, path + ' should be disabled');
  }
});

test('unknown routes return a structured 404 without requiring D1 or B2', async () => {
  const request = new Request('https://social.example/api/not-a-route', {
    headers: { Origin: 'https://flyinfinitydao.github.io' }
  });
  const response = await worker.fetch(request, { APP_ORIGIN: 'https://flyinfinitydao.github.io' });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Not found' });
});

test('preflight returns allowed methods and authorization headers', async () => {
  const request = new Request('https://social.example/api/posts', {
    method: 'OPTIONS',
    headers: { Origin: 'https://flyinfinitydao.github.io' }
  });
  const response = await worker.fetch(request, { APP_ORIGIN: 'https://flyinfinitydao.github.io' });
  assert.equal(response.status, 204);
  assert.match(response.headers.get('access-control-allow-methods'), /POST/);
  assert.match(response.headers.get('access-control-allow-methods'), /DELETE/);
  assert.match(response.headers.get('access-control-allow-headers'), /Authorization/);
});
