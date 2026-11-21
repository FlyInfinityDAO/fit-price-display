import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPreviewClient,
  reserveImagePreviewQuota,
  releaseImagePreviewQuota
} from '../src/image-preview-quota.js';

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
      const [clientHash, day, , limit] = values;
      const key = clientHash + '|' + day;
      const current = this.clients.get(key) || 0;
      if (current >= limit) return { meta: { changes: 0 } };
      this.clients.set(key, current + 1);
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('INSERT INTO image_preview_daily_usage')) {
      const [day, , limit] = values;
      const current = this.global.get(day) || 0;
      if (current >= limit) return { meta: { changes: 0 } };
      this.global.set(day, current + 1);
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('UPDATE image_preview_usage')) {
      const [, clientHash, day] = values;
      const key = clientHash + '|' + day;
      this.clients.set(key, Math.max(0, (this.clients.get(key) || 0) - 1));
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('UPDATE image_preview_daily_usage')) {
      const [, day] = values;
      this.global.set(day, Math.max(0, (this.global.get(day) || 0) - 1));
      return { meta: { changes: 1 } };
    }
    throw new Error('Unexpected SQL in fake D1: ' + sql);
  }

  async first(sql, values) {
    if (sql.startsWith('SELECT requests FROM image_preview_usage')) {
      const [clientHash, day] = values;
      return { requests: this.clients.get(clientHash + '|' + day) || 0 };
    }
    if (sql.startsWith('SELECT requests FROM image_preview_daily_usage')) {
      const [day] = values;
      return { requests: this.global.get(day) || 0 };
    }
    throw new Error('Unexpected SELECT in fake D1: ' + sql);
  }
}

const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);

test('preview client identity is salted and hashed, not stored as an IP address', async () => {
  const first = await hashPreviewClient('203.0.113.10', 'a'.repeat(32));
  const second = await hashPreviewClient('203.0.113.10', 'b'.repeat(32));
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, second);
  await assert.rejects(hashPreviewClient('', 'a'.repeat(32)), /address is unavailable/);
  await assert.rejects(hashPreviewClient('203.0.113.10', 'short'), /salt is not configured/);
});

test('preview client quota is limited to four images per UTC day', async () => {
  const db = new FakeD1();
  const options = { db, clientHash: hashA, day: '2026-11-21', timestamp: 1 };
  for (let i = 0; i < 4; i++) {
    const quota = await reserveImagePreviewQuota(options);
    assert.equal(quota.clientRemaining, 3 - i);
  }
  await assert.rejects(reserveImagePreviewQuota(options), /Daily image preview quota reached/);
  assert.equal(db.clients.get(hashA + '|2026-11-21'), 4);
  assert.equal(db.global.get('2026-11-21'), 4);
});

test('preview global quota rejects requests and rolls back the client reservation', async () => {
  const db = new FakeD1();
  db.global.set('2026-11-21', 25);
  await assert.rejects(
    reserveImagePreviewQuota({ db, clientHash: hashB, day: '2026-11-21', timestamp: 2 }),
    /Global daily image preview quota reached/
  );
  assert.equal(db.clients.get(hashB + '|2026-11-21'), 0);
  assert.equal(db.global.get('2026-11-21'), 25);
});

test('provider failures can release both preview quota reservations', async () => {
  const db = new FakeD1();
  const options = { db, clientHash: hashB, day: '2026-11-21', timestamp: 3 };
  await reserveImagePreviewQuota(options);
  await releaseImagePreviewQuota(options);
  assert.equal(db.clients.get(hashB + '|2026-11-21'), 0);
  assert.equal(db.global.get('2026-11-21'), 0);
});
