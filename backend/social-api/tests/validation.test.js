import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeHandle, parseProfileInput, parsePostInput, parseCursor, makeCursor,
  allowedMediaType, hasValidMediaSignature, safeFileExtension
} from '../src/validation.js';

test('handles normalize to lowercase and reject invalid characters and lengths', () => {
  assert.equal(normalizeHandle('@Fly_Creator22'), 'fly_creator22');
  assert.throws(() => normalizeHandle('ab'), /3–24/);
  assert.throws(() => normalizeHandle('bad handle'), /3–24/);
});

test('profile input validates display name, biography and supported language', () => {
  assert.deepEqual(parseProfileInput({
    handle: 'Creator_01', displayName: 'Fly Creator', bio: 'Digital artist', language: 'fa'
  }), { handle: 'creator_01', displayName: 'Fly Creator', bio: 'Digital artist', language: 'fa' });
  assert.throws(() => parseProfileInput({ handle: 'artist1', displayName: 'A', language: 'en' }), /2–50/);
  assert.throws(() => parseProfileInput({ handle: 'artist1', displayName: 'Artist One', language: 'xx' }), /Unsupported/);
});

test('post input accepts prompt posts and requires matching media keys for media posts', () => {
  const prompt = parsePostInput({ title: 'A reusable prompt', mediaType: 'prompt', prompt: 'A cinematic golden city' });
  assert.equal(prompt.mediaType, 'prompt');
  assert.equal(prompt.mediaKey, null);
  assert.throws(() => parsePostInput({ title: 'Missing file', mediaType: 'image' }), /Upload an image or audio/);
  assert.throws(() => parsePostInput({ title: 'Wrong type', mediaType: 'video' }), /Unsupported/);
  assert.throws(() => parsePostInput({ title: 'Long', mediaType: 'prompt', description: 'x'.repeat(321) }), /too long/);
});

test('feed cursor round-trips stable timestamp and post ID', () => {
  const cursor = makeCursor(1795305600, 'post-abc');
  assert.deepEqual(parseCursor(cursor), { createdAt: 1795305600, postId: 'post-abc' });
  assert.equal(parseCursor('not-a-cursor'), null);
  assert.equal(parseCursor(''), null);
});

test('only supported image and audio MIME types are accepted', () => {
  assert.deepEqual(allowedMediaType('image/png'), { mediaType: 'image', contentType: 'image/png' });
  assert.deepEqual(allowedMediaType('audio/mpeg'), { mediaType: 'audio', contentType: 'audio/mpeg' });
  assert.equal(allowedMediaType('image/svg+xml'), null);
  assert.equal(allowedMediaType('application/zip'), null);
});

test('file signatures must match the declared media type', () => {
  const png = Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0]).buffer;
  const jpeg = Uint8Array.from([0xff,0xd8,0xff,0,0]).buffer;
  const wav = Uint8Array.from([...'RIFF',0,0,0,0,...'WAVE',0,0]).buffer;
  assert.equal(hasValidMediaSignature(png, 'image/png'), true);
  assert.equal(hasValidMediaSignature(png, 'image/jpeg'), false);
  assert.equal(hasValidMediaSignature(jpeg, 'image/jpeg'), true);
  assert.equal(hasValidMediaSignature(wav, 'audio/wav'), true);
  assert.equal(safeFileExtension('image/webp'), 'webp');
  assert.equal(safeFileExtension('application/pdf'), null);
});
