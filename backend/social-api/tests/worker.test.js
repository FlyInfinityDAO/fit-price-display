import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { extractBearerToken, createPublicMediaHeaders } from '../src/index.js';

test('Bearer session tokens are extracted from standard Authorization headers', () => {
  const token = 'a'.repeat(64);
  assert.equal(extractBearerToken('Bearer ' + token), token);
  assert.equal(extractBearerToken('bearer ' + token), token);
  assert.equal(extractBearerToken('  ' + 'Bearer ' + token), '');
  assert.equal(extractBearerToken(null), '');
  assert.equal(extractBearerToken(''), '');
});

test('public Social images can be embedded from the separate GitHub Pages site', () => {
  const headers = createPublicMediaHeaders('image/png', 2048, '"social-image-etag"');
  assert.equal(headers.get('Content-Type'), 'image/png');
  assert.equal(headers.get('Content-Length'), '2048');
  assert.equal(headers.get('Cross-Origin-Resource-Policy'), 'cross-origin');
  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(headers.get('ETag'), '"social-image-etag"');
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

test('Social discovery, profile, follow and notification routes are exposed behind a password session', async () => {
  const requests = [
    ['GET', '/api/explore'],
    ['GET', '/api/profiles/alice'],
    ['GET', '/api/profiles/alice/followers'],
    ['GET', '/api/profiles/alice/following'],
    ['POST', '/api/profiles/alice/follow'],
    ['DELETE', '/api/profiles/alice/follow'],
    ['GET', '/api/notifications'],
    ['POST', '/api/notifications/read-all'],
    ['PATCH', '/api/notifications/notification-1/read']
  ];
  for (const [method, path] of requests) {
    const response = await worker.fetch(new Request('https://social.example' + path, {
      method,
      headers: { Origin: 'https://flyinfinitydao.github.io' }
    }), { APP_ORIGIN: 'https://flyinfinitydao.github.io' });
    assert.equal(response.status, 401, method + ' ' + path + ' should require a session, not return 404');
    assert.deepEqual(await response.json(), { error: 'Connect your Fly Infinity wallet to continue' });
  }
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
