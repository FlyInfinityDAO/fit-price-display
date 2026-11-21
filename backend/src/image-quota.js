export const IMAGE_DAILY_LIMITS = Object.freeze({ 1: 5, 2: 10, 3: 20 });
export const IMAGE_GLOBAL_DAILY_LIMIT = 250;

export async function reserveImageQuota({
  db,
  address,
  tier,
  day = new Date().toISOString().slice(0, 10),
  timestamp = Math.floor(Date.now() / 1000)
}) {
  if (!db || typeof db.prepare !== 'function') throw new Error('Image quota database is not configured');
  if (typeof address !== 'string' || !address.trim()) throw new Error('A valid wallet address is required');

  const userLimit = IMAGE_DAILY_LIMITS[Number(tier)] || IMAGE_DAILY_LIMITS[1];
  const userReservation = await db.prepare(
    'INSERT INTO image_generation_usage(address,day,requests,updated_at) VALUES(?,?,1,?) ' +
    'ON CONFLICT(address,day) DO UPDATE SET requests=requests+1,updated_at=excluded.updated_at WHERE requests < ?'
  ).bind(address, day, timestamp, userLimit).run();

  if (Number(userReservation.meta?.changes || 0) !== 1) {
    throw new Error('Daily image generation quota reached');
  }

  try {
    const globalReservation = await db.prepare(
      'INSERT INTO image_generation_daily_usage(day,requests,updated_at) VALUES(?,1,?) ' +
      'ON CONFLICT(day) DO UPDATE SET requests=requests+1,updated_at=excluded.updated_at WHERE requests < ?'
    ).bind(day, timestamp, IMAGE_GLOBAL_DAILY_LIMIT).run();

    if (Number(globalReservation.meta?.changes || 0) !== 1) {
      throw new Error('Global daily image quota reached');
    }
  } catch (error) {
    try {
      await db.prepare(
        'UPDATE image_generation_usage SET requests=CASE WHEN requests>0 THEN requests-1 ELSE 0 END,updated_at=? WHERE address=? AND day=?'
      ).bind(timestamp, address, day).run();
    } catch (rollbackError) {
      console.error('Image user quota rollback failed:', rollbackError?.message || rollbackError);
    }
    throw error;
  }

  try {
    const [userRow, globalRow] = await Promise.all([
      db.prepare('SELECT requests FROM image_generation_usage WHERE address=? AND day=?').bind(address, day).first(),
      db.prepare('SELECT requests FROM image_generation_daily_usage WHERE day=?').bind(day).first()
    ]);

    return {
      day,
      userLimit,
      userRemaining: Math.max(0, userLimit - Number(userRow?.requests || userLimit)),
      globalLimit: IMAGE_GLOBAL_DAILY_LIMIT,
      globalRemaining: Math.max(0, IMAGE_GLOBAL_DAILY_LIMIT - Number(globalRow?.requests || IMAGE_GLOBAL_DAILY_LIMIT))
    };
  } catch (error) {
    await releaseImageQuota({ db, address, day, timestamp });
    throw error;
  }
}

export async function releaseImageQuota({
  db,
  address,
  day = new Date().toISOString().slice(0, 10),
  timestamp = Math.floor(Date.now() / 1000)
}) {
  await Promise.all([
    db.prepare(
      'UPDATE image_generation_usage SET requests=CASE WHEN requests>0 THEN requests-1 ELSE 0 END,updated_at=? WHERE address=? AND day=?'
    ).bind(timestamp, address, day).run(),
    db.prepare(
      'UPDATE image_generation_daily_usage SET requests=CASE WHEN requests>0 THEN requests-1 ELSE 0 END,updated_at=? WHERE day=?'
    ).bind(timestamp, day).run()
  ]);
}
