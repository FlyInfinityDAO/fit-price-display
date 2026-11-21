import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const JPEG_BASE64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2w==';

class FakeD1 {
  constructor() {
    this.clients = new Map();
    this.global = new Map();
  }
  prepare(sql) {
    return {
      bind: (...values) => ({
        run: async () => this.run(sql, values),
        first: async () => this.first(sql, values)
      })
    };
  }
  async run(sql, values) {
    if (sql.startsWith('INSERT INTO image_preview_usage')) {
      const [hash, day, , limit] = values, key = hash + '|' + day, current = this.clients.get(key) || 0;
      if (current >= limit) return { meta: { changes: 0 } };
      this.clients.set(key, current + 1);
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('INSERT INTO image_preview_daily_usage')) {
      const [day, , limit] = values, current = this.global.get(day) || 0;
      if (current >= limit) return { meta: { changes: 0 } };
      this.global.set(day, current + 1);
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('UPDATE image_preview_usage')) {
      const [, hash, day] = values, key = hash + '|' + day;
      this.clients.set(key, Math.max(0, (this.clients.get(key) || 0) - 1));
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('UPDATE image_preview_daily_usage')) {
      const [, day] = values;
      this.global.set(day, Math.max(0, (this.global.get(day) || 0) - 1));
      return { meta: { changes: 1 } };
    }
    throw new Error('Unexpected SQL: ' + sql);
  }
  async first(sql, values) {
    if (sql.startsWith('SELECT requests FROM image_preview_usage')) {
      const [hash, day] = values;
      return { requests: this.clients.get(hash + '|' + day) || 0 };
    }
    if (sql.startsWith('SELECT requests FROM image_preview_daily_usage')) {
      const [day] = values;
      return { requests: this.global.get(day) || 0 };
    }
    throw new Error('Unexpected SELECT: ' + sql);
  }
}

function makeEnv(overrides = {}) {
  return {
    APP_ORIGIN: 'https://raw.githack.com',
    IMAGE_PREVIEW_ENABLED: 'true',
    IMAGE_PREVIEW_SALT: 's'.repeat(64),
    AI: { run: async () => ({ image: JPEG_BASE64 }) },
    DB: new FakeD1(),
    ...overrides
  };
}

function makeRequest({ origin = 'https://raw.githack.com', ip = '203.0.113.10', body = { prompt: 'A premium cinematic product photo of a gold watch' } } = {}) {
  return new Request('https://fly-ai-image-test.example/api/image/preview', {
    method: 'POST',
    headers: {
      Origin: origin,
      'CF-Connecting-IP': ip,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

test('preview endpoint is disabled unless explicitly enabled on the test Worker', async () => {
  const response = await worker.fetch(makeRequest(), makeEnv({ IMAGE_PREVIEW_ENABLED: 'false' }), {});
  assert.equal(response.status, 404);
});

test('preview endpoint requires the dedicated preview origin', async () => {
  const response = await worker.fetch(makeRequest({ origin: 'https://example.com' }), makeEnv(), {});
  assert.equal(response.status, 403);
});

test('preview endpoint generates an image without wallet auth or bearer token', async () => {
  const env = makeEnv();
  const response = await worker.fetch(makeRequest(), env, {});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'image/jpeg');
  assert.equal(response.headers.get('X-Image-Preview-Mode'), 'true');
  assert.equal(response.headers.get('X-Image-Quota-Remaining'), '3');
  assert.equal(response.headers.get('X-Image-Global-Quota-Remaining'), '24');
  assert.equal(env.DB.global.get(new Date().toISOString().slice(0, 10)), 1);
});

test('preview endpoint validates prompts before reserving quota', async () => {
  const env = makeEnv();
  const response = await worker.fetch(makeRequest({ body: { prompt: 'short' } }), env, {});
  assert.equal(response.status, 400);
  assert.equal(env.DB.global.size, 0);
});
