import test from 'node:test';
import assert from 'node:assert/strict';
import { AUDIO_DAILY_LIMITS, AUDIO_GLOBAL_DAILY_CHARACTER_LIMIT, reserveAudioQuota, releaseAudioQuota } from '../src/audio-quota.js';

class FakeD1 {
  constructor() { this.users = new Map(); this.global = new Map(); }
  prepare(sql) {
    return { bind: (...values) => ({
      run: async () => this.run(sql, values),
      first: async () => this.first(sql, values)
    }) };
  }
  async run(sql, values) {
    if (sql.startsWith('INSERT INTO audio_speech_usage')) {
      const [address, day, chars, , limit] = values, key = address + '|' + day;
      const current = this.users.get(key) || { requests: 0, characters: 0 };
      if (current.requests >= limit) return { meta: { changes: 0 } };
      this.users.set(key, { requests: current.requests + 1, characters: current.characters + chars });
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('INSERT INTO audio_speech_global_usage')) {
      const [day, chars, , limit] = values, current = this.global.get(day) || { requests: 0, characters: 0 };
      if (current.characters + chars > limit) return { meta: { changes: 0 } };
      this.global.set(day, { requests: current.requests + 1, characters: current.characters + chars });
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('UPDATE audio_speech_usage')) {
      const [chars, , , address, day] = values, key = address + '|' + day;
      const current = this.users.get(key) || { requests: 0, characters: 0 };
      this.users.set(key, { requests: Math.max(0, current.requests - 1), characters: Math.max(0, current.characters - chars) });
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('UPDATE audio_speech_global_usage')) {
      const [chars, , , day] = values, current = this.global.get(day) || { requests: 0, characters: 0 };
      this.global.set(day, { requests: Math.max(0, current.requests - 1), characters: Math.max(0, current.characters - chars) });
      return { meta: { changes: 1 } };
    }
    throw new Error('Unexpected SQL: ' + sql);
  }
  async first(sql, values) {
    if (sql.startsWith('SELECT requests,characters FROM audio_speech_usage')) {
      const [address, day] = values;
      return this.users.get(address + '|' + day) || { requests: 0, characters: 0 };
    }
    if (sql.startsWith('SELECT characters,requests FROM audio_speech_global_usage')) {
      const [day] = values;
      return this.global.get(day) || { requests: 0, characters: 0 };
    }
    throw new Error('Unexpected SELECT: ' + sql);
  }
}

test('daily per-wallet speech quotas are 2, 4 and 8 for the three tiers', () => {
  assert.deepEqual(AUDIO_DAILY_LIMITS, { 1: 2, 2: 4, 3: 8 });
});

for (const [tier, limit] of Object.entries(AUDIO_DAILY_LIMITS)) {
  test(`tier ${tier} can reserve exactly ${limit} voice generations per UTC day`, async () => {
    const db = new FakeD1(), options = { db, address: '0xabc', tier: Number(tier), characters: 20, day: '2026-11-21', timestamp: 1 };
    for (let i = 0; i < limit; i++) assert.equal((await reserveAudioQuota(options)).userRemaining, limit - i - 1);
    await assert.rejects(reserveAudioQuota(options), /Daily voice generation quota reached/);
    assert.equal(db.users.get('0xabc|2026-11-21').requests, limit);
  });
}

test('global character budget rolls back wallet reservation when exhausted', async () => {
  const db = new FakeD1();
  db.global.set('2026-11-21', { requests: 1, characters: AUDIO_GLOBAL_DAILY_CHARACTER_LIMIT });
  await assert.rejects(
    reserveAudioQuota({ db, address: '0xdef', tier: 3, characters: 50, day: '2026-11-21', timestamp: 2 }),
    /Global free audio capacity reached/
  );
  assert.equal(db.users.get('0xdef|2026-11-21').requests, 0);
});

test('failed model calls release both per-wallet and global speech reservations', async () => {
  const db = new FakeD1(), options = { db, address: '0x123', tier: 2, characters: 40, day: '2026-11-21', timestamp: 3 };
  await reserveAudioQuota(options);
  await releaseAudioQuota(options);
  assert.deepEqual(db.users.get('0x123|2026-11-21'), { requests: 0, characters: 0 });
  assert.deepEqual(db.global.get('2026-11-21'), { requests: 0, characters: 0 });
});

test('oversized speech input is rejected before quota reservation', async () => {
  const db = new FakeD1();
  await assert.rejects(
    reserveAudioQuota({ db, address: '0x123', tier: 1, characters: 301, day: '2026-11-21' }),
    /1–300 characters/
  );
});
