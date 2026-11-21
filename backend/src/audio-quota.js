export const AUDIO_DAILY_LIMITS = Object.freeze({ 1: 2, 2: 4, 3: 8 });
export const AUDIO_GLOBAL_DAILY_CHARACTER_LIMIT = 1200;

export async function reserveAudioQuota({ db, address, tier, characters, day = new Date().toISOString().slice(0, 10), timestamp = Math.floor(Date.now() / 1000) }) {
  if (!db || typeof db.prepare !== 'function') throw new Error('Audio quota database is not configured');
  if (typeof address !== 'string' || !address.trim()) throw new Error('A valid wallet address is required');
  if (!Number.isInteger(characters) || characters < 1 || characters > 300) throw new Error('Speech text must contain 1–300 characters');

  const limit = AUDIO_DAILY_LIMITS[Number(tier)] || AUDIO_DAILY_LIMITS[1];
  const user = await db.prepare(
    'INSERT INTO audio_speech_usage(address,day,requests,characters,updated_at) VALUES(?,?,1,?,?) ' +
    'ON CONFLICT(address,day) DO UPDATE SET requests=requests+1,characters=characters+excluded.characters,updated_at=excluded.updated_at WHERE requests < ?'
  ).bind(address, day, characters, timestamp, limit).run();
  if (Number(user.meta?.changes || 0) !== 1) throw new Error('Daily voice generation quota reached');

  try {
    const global = await db.prepare(
      'INSERT INTO audio_speech_global_usage(day,characters,requests,updated_at) VALUES(?,?,1,?) ' +
      'ON CONFLICT(day) DO UPDATE SET characters=characters+excluded.characters,requests=requests+1,updated_at=excluded.updated_at WHERE characters + excluded.characters <= ?'
    ).bind(day, characters, timestamp, AUDIO_GLOBAL_DAILY_CHARACTER_LIMIT).run();
    if (Number(global.meta?.changes || 0) !== 1) throw new Error('Global free audio capacity reached for today');
  } catch (error) {
    await db.prepare(
      'UPDATE audio_speech_usage SET requests=CASE WHEN requests>0 THEN requests-1 ELSE 0 END,characters=CASE WHEN characters>=? THEN characters-? ELSE 0 END,updated_at=? WHERE address=? AND day=?'
    ).bind(characters, characters, timestamp, address, day).run();
    throw error;
  }

  const [userRow, globalRow] = await Promise.all([
    db.prepare('SELECT requests,characters FROM audio_speech_usage WHERE address=? AND day=?').bind(address, day).first(),
    db.prepare('SELECT characters,requests FROM audio_speech_global_usage WHERE day=?').bind(day).first()
  ]);
  return {
    day, userLimit: limit,
    userRemaining: Math.max(0, limit - Number(userRow?.requests || limit)),
    charactersRemaining: Math.max(0, AUDIO_GLOBAL_DAILY_CHARACTER_LIMIT - Number(globalRow?.characters || 0))
  };
}

export async function releaseAudioQuota({ db, address, day, characters, timestamp = Math.floor(Date.now() / 1000) }) {
  await Promise.all([
    db.prepare(
      'UPDATE audio_speech_usage SET requests=CASE WHEN requests>0 THEN requests-1 ELSE 0 END,characters=CASE WHEN characters>=? THEN characters-? ELSE 0 END,updated_at=? WHERE address=? AND day=?'
    ).bind(characters, characters, timestamp, address, day).run(),
    db.prepare(
      'UPDATE audio_speech_global_usage SET requests=CASE WHEN requests>0 THEN requests-1 ELSE 0 END,characters=CASE WHEN characters>=? THEN characters-? ELSE 0 END,updated_at=? WHERE day=?'
    ).bind(characters, characters, timestamp, day).run()
  ]);
}
