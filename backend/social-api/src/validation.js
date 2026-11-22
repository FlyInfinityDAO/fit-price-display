const HANDLE_RE = /^[a-z0-9_]{3,24}$/;
const LANGUAGES = new Set(['en','fa','ar','tr','ru','zh','es','pt']);
const IMAGE_TYPES = new Set(['image/png','image/jpeg','image/webp']);
const AUDIO_TYPES = new Set(['audio/mpeg','audio/wav','audio/x-wav','audio/ogg','audio/mp4','audio/aac']);

export function normalizeHandle(value) {
  const handle = String(value || '').trim().toLowerCase().replace(/^@/, '');
  if (!HANDLE_RE.test(handle)) {
    throw new Error('Handle must be 3–24 characters and use only letters, numbers or underscores');
  }
  return handle;
}

export function parseProfileInput(body) {
  const handle = normalizeHandle(body?.handle);
  const displayName = String(body?.displayName || '').trim();
  const bio = String(body?.bio || '').trim();
  const language = String(body?.language || 'en').toLowerCase();
  if (displayName.length < 2 || displayName.length > 50) throw new Error('Display name must contain 2–50 characters');
  if (bio.length > 180) throw new Error('Bio must be 180 characters or fewer');
  if (!LANGUAGES.has(language)) throw new Error('Unsupported interface language');
  return { handle, displayName, bio, language };
}

export function parsePostInput(body) {
  const title = String(body?.title || '').trim();
  const mediaType = String(body?.mediaType || '').toLowerCase();
  const description = String(body?.description || '').trim();
  const prompt = String(body?.prompt || '').trim();
  const mediaKey = body?.mediaKey == null || body.mediaKey === '' ? null : String(body.mediaKey);
  const sourcePostId = body?.sourcePostId == null || body.sourcePostId === '' ? null : String(body.sourcePostId);
  const challengeId = body?.challengeId == null || body.challengeId === '' ? null : String(body.challengeId);
  if (title.length < 2 || title.length > 90) throw new Error('Title must contain 2–90 characters');
  if (!['image','audio','prompt'].includes(mediaType)) throw new Error('Unsupported creation type');
  if (description.length > 320 || prompt.length > 1200) throw new Error('Description or prompt is too long');
  if (mediaType === 'image' || mediaType === 'audio') {
    if (!mediaKey || mediaKey.length > 180 || mediaKey.includes('..')) throw new Error('Upload an image or audio file before publishing');
  } else if (mediaKey) {
    throw new Error('Prompt-only posts cannot contain a media file');
  }
  if (sourcePostId && sourcePostId.length > 80) throw new Error('Invalid source post');
  if (challengeId && challengeId.length > 80) throw new Error('Invalid challenge');
  return { title, mediaType, description, prompt, mediaKey, sourcePostId, challengeId };
}

export function parseCursor(value) {
  if (!value) return null;
  try {
    const decoded = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
    const [createdRaw, postId] = decoded.split('|');
    const createdAt = Number(createdRaw);
    if (!Number.isSafeInteger(createdAt) || !postId || postId.length > 80) return null;
    return { createdAt, postId };
  } catch {
    return null;
  }
}

export function makeCursor(createdAt, postId) {
  return btoa(String(createdAt) + '|' + String(postId))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function allowedMediaType(contentType) {
  const type = String(contentType || '').toLowerCase().split(';')[0].trim();
  if (IMAGE_TYPES.has(type)) return { mediaType: 'image', contentType: type };
  if (AUDIO_TYPES.has(type)) return { mediaType: 'audio', contentType: type };
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
    case 'audio/wav':
    case 'audio/x-wav': return ascii(0,4) === 'RIFF' && ascii(8,4) === 'WAVE';
    case 'audio/ogg': return ascii(0,4) === 'OggS';
    case 'audio/mpeg': return ascii(0,3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0);
    case 'audio/mp4': return ascii(4,4) === 'ftyp';
    case 'audio/aac': return b[0] === 0xff && (b[1] & 0xf6) === 0xf0;
    default: return false;
  }
}

export function safeFileExtension(contentType) {
  return ({
    'image/png':'png','image/jpeg':'jpg','image/webp':'webp',
    'audio/mpeg':'mp3','audio/wav':'wav','audio/x-wav':'wav',
    'audio/ogg':'ogg','audio/mp4':'m4a','audio/aac':'aac'
  })[contentType] || null;
}
