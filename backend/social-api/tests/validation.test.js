import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeHandle, parseAccountInput, parsePasswordInput, parsePostInput,
  allowedMediaType, hasValidMediaSignature, safeFileExtension
} from '../src/validation.js';

test('usernames normalize to lowercase and reject invalid characters and lengths', () => {
  assert.equal(normalizeHandle('@Fly_Creator22'), 'fly_creator22');
  assert.throws(() => normalizeHandle('ab'), /3–24/);
  assert.throws(() => normalizeHandle('bad handle'), /3–24/);
});

test('account creation requires a valid unique-ready username shape and strong-length password', () => {
  assert.deepEqual(parseAccountInput({ handle: 'Creator_01', password: 'this-is-a-safe-password' }), {
    handle: 'creator_01', password: 'this-is-a-safe-password'
  });
  assert.throws(() => parseAccountInput({ handle: 'creator1', password: 'short' }), /10–128/);
  assert.throws(() => parsePasswordInput({ password: 'x'.repeat(129) }), /10–128/);
});

test('post input accepts text-only, image-only and combined posts, but rejects empty or unsupported media', () => {
  assert.deepEqual(parsePostInput({ text: 'A simple text post' }), {
    text: 'A simple text post', mediaKey: null
  });
  assert.deepEqual(parsePostInput({ mediaKey: 'uploads/image.webp' }), {
    text: '', mediaKey: 'uploads/image.webp'
  });
  assert.deepEqual(parsePostInput({ text: 'Hello', mediaKey: 'uploads/image.webp' }), {
    text: 'Hello', mediaKey: 'uploads/image.webp'
  });
  assert.throws(() => parsePostInput({}), /Write a message or attach an image/);
  assert.throws(() => parsePostInput({ text: 'x'.repeat(2001) }), /2000 characters/);
  assert.throws(() => parsePostInput({ text: 'Hi', mediaKey: '../bad.png' }), /Invalid uploaded image/);
});

test('only PNG, JPEG and WebP are accepted as social media', () => {
  assert.deepEqual(allowedMediaType('image/png'), { mediaType: 'image', contentType: 'image/png' });
  assert.deepEqual(allowedMediaType('image/jpeg'), { mediaType: 'image', contentType: 'image/jpeg' });
  assert.deepEqual(allowedMediaType('image/webp'), { mediaType: 'image', contentType: 'image/webp' });
  assert.equal(allowedMediaType('audio/mpeg'), null);
  assert.equal(allowedMediaType('image/svg+xml'), null);
  assert.equal(allowedMediaType('application/zip'), null);
});

test('image binary signatures must match the declared file type', () => {
  const png = Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0]).buffer;
  const jpeg = Uint8Array.from([0xff,0xd8,0xff,0,0]).buffer;
  const wav = Uint8Array.from([0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x41,0x56,0x45,0,0]).buffer;
  assert.equal(hasValidMediaSignature(png, 'image/png'), true);
  assert.equal(hasValidMediaSignature(png, 'image/jpeg'), false);
  assert.equal(hasValidMediaSignature(jpeg, 'image/jpeg'), true);
  assert.equal(hasValidMediaSignature(wav, 'audio/wav'), false);
  assert.equal(safeFileExtension('image/webp'), 'webp');
  assert.equal(safeFileExtension('audio/mpeg'), null);
});
