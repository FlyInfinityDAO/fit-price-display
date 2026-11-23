const HANDLE_RE = /^[a-z0-9_]{3,24}$/;
const IMAGE_TYPES = new Set(['image/png','image/jpeg','image/webp']);

export function normalizeHandle(value) {
  const handle = String(value || '').trim().toLowerCase().replace(/^@/, '');
  if (!HANDLE_RE.test(handle)) {
    throw new Error('Username must be 3–24 characters and use only English letters, numbers or underscores');
  }
  return handle;
}

export function parseAccountInput(body) {
  const handle = normalizeHandle(body?.handle);
  const password = String(body?.password || '');
  if (password.length < 6 || password.length > 128) {
    throw new Error('Password must contain 6–128 characters');
  }
  return { handle, password };
}

export function parsePasswordInput(body) {
  const password = String(body?.password || '');
  if (password.length < 6 || password.length > 128) {
    throw new Error('Password must contain 6–128 characters');
  }
  return password;
}

export function parsePostInput(body) {
  const text = String(body?.text || '').trim();
  const mediaKey = body?.mediaKey == null || body.mediaKey === '' ? null : String(body.mediaKey);
  if (text.length > 2000) throw new Error('Post text must be 2000 characters or fewer');
  if (!text && !mediaKey) throw new Error('Write a message or attach an image before publishing');
  if (mediaKey && (mediaKey.length > 180 || mediaKey.includes('..') || !mediaKey.startsWith('uploads/'))) {
    throw new Error('Invalid uploaded image');
  }
  return { text, mediaKey };
}

export function allowedMediaType(contentType) {
  const type = String(contentType || '').toLowerCase().split(';')[0].trim();
  if (IMAGE_TYPES.has(type)) return { mediaType: 'image', contentType: type };
  return null;
}

export function hasValidMediaSignature(buffer, contentType) {
  const b = new Uint8Array(buffer);
  const ascii = (start, length) => String.fromCharCode(...b.slice(start, start + length));
  const starts = (...bytes) => bytes.every((v, i) => b[i] === v);
  switch (contentType) {
    case 'image/png': return starts(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a);
    case 'image/jpeg': return starts(0xff,0xd8,0xff);
    case 'image/webp': return ascii(0,4) === 'RIFF' && ascii(8,4) === 'WEBP';
    default: return false;
  }
}

export function safeFileExtension(contentType) {
  return ({ 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp' })[contentType] || null;
}
