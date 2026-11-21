import test from 'node:test';
import assert from 'node:assert/strict';
import { IMAGE_DAILY_LIMITS, reserveImageQuota, releaseImageQuota } from '../src/image-quota.js';

class FakeD1 {
  constructor() {
    this.users = new Map();
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
    if (sql.startsWith('INSERT INTO image_generation_usage')) {
      const [address, day, , limit] = values;
      const key = address + '|' + day;
      const current = this.users.get(key) || 0;
      if (current >= limit) return { meta: { changes: 0 } };
      this.users.set(key, current + 1);
      return { meta: { changes: 1 } };
    }

    if (sql.startsWith('INSERT INTO image_generation_daily_usage')) {
      const [day, , limit] = values;
      const current = this.global.get(day) || 0;
      if (current >= limit) return { meta: { changes: 0 } };
      this.global.set(day, current + 1);
      return { meta: { changes: 1 } };
    }

    if (sql.startsWith('UPDATE image_generation_usage')) {
      const [, address, day] = values;
      const key = address + '|' + day;
      this.users.set(key, Math.max(0, (this.users.get(key) || 0) - 1));
      return { meta: { changes: 1 } };
    }

    if (sql.startsWith('UPDATE image_generation_daily_usage')) {
      const [, day] = values;
      this.global.set(day, Math.max(0, (this.global.get(day) || 0) - 1));
      return { meta: { changes: 1 } };
    }

    throw new Error('Unexpected SQL in fake D1: ' + sql);
  }

  async first(sql, values) {
    if (sql.startsWith('SELECT requests FROM image_generation_usage')) {
      const [address, day] = values;
      return { requests: this.users.get(address + '|' + day) || 0 };
    }
    if (sql.startsWith('SELECT requests FROM image_generation_daily_usage')) {
      const [day] = values;
      return { requests: this.global.get(day) || 0 };
    }
    throw new Error('Unexpected SELECT in fake D1: ' + sql);
  }
}

test('configured daily image limits are 2, 4 and 8 for tiers 1, 2 and 3', () => {
  assert.deepEqual(IMAGE_DAILY_LIMITS, { 1: 2, 2: 4, 3: 8 });
});

for (const [tier, limit] of Object.entries(IMAGE_DAILY_LIMITS)) {
  test(`tier ${tier} image quota allows exactly ${limit} images per UTC day`, async () => {
    const db = new FakeD1();
    const options = { db, address: '0xabc', tier: Number(tier), day: '2026-11-21', timestamp: 1 };

    for (let i = 0; i < limit; i++) {
      const quota = await reserveImageQuota(options);
      assert.equal(quota.userRemaining, limit - i - 1);
    }

    await assert.rejects(reserveImageQuota(options), /Daily image generation quota reached/);
    assert.equal(db.users.get('0xabc|2026-11-21'), limit);
    assert.equal(db.global.get('2026-11-21'), limit);
  });
}

test('global daily cap rejects a request and rolls back the wallet reservation', async () => {
  const db = new FakeD1();
  db.global.set('2026-11-21', 250);

  await assert.rejects(
    reserveImageQuota({ db, address: '0xdef', tier: 3, day: '2026-11-21', timestamp: 2 }),
    /Global daily image quota reached/
  );

  assert.equal(db.users.get('0xdef|2026-11-21'), 0);
  assert.equal(db.global.get('2026-11-21'), 250);
});

test('failed generation releases both wallet and global reservations', async () => {
  const db = new FakeD1();
  const options = { db, address: '0x123', tier: 2, day: '2026-11-21', timestamp: 3 };

  await reserveImageQuota(options);
  await releaseImageQuota(options);

  assert.equal(db.users.get('0x123|2026-11-21'), 0);
  assert.equal(db.global.get('2026-11-21'), 0);
});
