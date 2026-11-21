export const IMAGE_PREVIEW_CLIENT_DAILY_LIMIT = 4;
export const IMAGE_PREVIEW_GLOBAL_DAILY_LIMIT = 25;

export async function hashPreviewClient(ipAddress, salt) {
  if (typeof ipAddress !== 'string' || !ipAddress.trim()) {
    throw new Error('Preview client address is unavailable');
  }
  if (typeof salt !== 'string' || salt.length < 32) {
    throw new Error('Image preview salt is not configured');
  }
  const source = new TextEncoder().encode(salt + ':' + ipAddress.trim());
  const digest = await crypto.subtle.digest('SHA-256', source);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function reserveImagePreviewQuota({
  db,
  clientHash,
  day = new Date().toISOString().slice(0, 10),
  timestamp = Math.floor(Date.now() / 1000)
}) {
  if (!db || typeof db.prepare !== 'function') throw new Error('Image preview database is not configured');
  if (typeof clientHash !== 'string' || !/^[a-f0-9]{64}$/.test(clientHash)) {
    throw new Error('Invalid image preview client identifier');
  }

  const clientReservation = await db.prepare(
    'INSERT INTO image_preview_usage(client_hash,day,requests,updated_at) VALUES(?,?,1,?) ' +
    'ON CONFLICT(client_hash,day) DO UPDATE SET requests=requests+1,updated_at=excluded.updated_at WHERE requests < ?'
  ).bind(clientHash, day, timestamp, IMAGE_PREVIEW_CLIENT_DAILY_LIMIT).run();

  if (Number(clientReservation.meta?.changes || 0) !== 1) {
    throw new Error('Daily image preview quota reached');
  }

  try {
    const globalReservation = await db.prepare(
      'INSERT INTO image_preview_daily_usage(day,requests,updated_at) VALUES(?,1,?) ' +
      'ON CONFLICT(day) DO UPDATE SET requests=requests+1,updated_at=excluded.updated_at WHERE requests < ?'
    ).bind(day, timestamp, IMAGE_PREVIEW_GLOBAL_DAILY_LIMIT).run();

    if (Number(globalReservation.meta?.changes || 0) !== 1) {
      throw new Error('Global daily image preview quota reached');
    }
  } catch (error) {
    try {
      await db.prepare(
        'UPDATE image_preview_usage SET requests=CASE WHEN requests>0 THEN requests-1 ELSE 0 END,updated_at=? WHERE client_hash=? AND day=?'
      ).bind(timestamp, clientHash, day).run();
    } catch (rollbackError) {
      console.error('Image preview client quota rollback failed:', rollbackError?.message || rollbackError);
    }
    throw error;
  }

  try {
    const [clientRow, globalRow] = await Promise.all([
      db.prepare('SELECT requests FROM image_preview_usage WHERE client_hash=? AND day=?').bind(clientHash, day).first(),
      db.prepare('SELECT requests FROM image_preview_daily_usage WHERE day=?').bind(day).first()
    ]);

    return {
      day,
      clientLimit: IMAGE_PREVIEW_CLIENT_DAILY_LIMIT,
      clientRemaining: Math.max(0, IMAGE_PREVIEW_CLIENT_DAILY_LIMIT - Number(clientRow?.requests || IMAGE_PREVIEW_CLIENT_DAILY_LIMIT)),
      globalLimit: IMAGE_PREVIEW_GLOBAL_DAILY_LIMIT,
      globalRemaining: Math.max(0, IMAGE_PREVIEW_GLOBAL_DAILY_LIMIT - Number(globalRow?.requests || IMAGE_PREVIEW_GLOBAL_DAILY_LIMIT))
    };
  } catch (error) {
    await releaseImagePreviewQuota({ db, clientHash, day, timestamp });
    throw error;
  }
}

export async function releaseImagePreviewQuota({
  db,
  clientHash,
  day = new Date().toISOString().slice(0, 10),
  timestamp = Math.floor(Date.now() / 1000)
}) {
  await Promise.all([
    db.prepare(
      'UPDATE image_preview_usage SET requests=CASE WHEN requests>0 THEN requests-1 ELSE 0 END,updated_at=? WHERE client_hash=? AND day=?'
    ).bind(timestamp, clientHash, day).run(),
    db.prepare(
      'UPDATE image_preview_daily_usage SET requests=CASE WHEN requests>0 THEN requests-1 ELSE 0 END,updated_at=? WHERE day=?'
    ).bind(timestamp, day).run()
  ]);
}
