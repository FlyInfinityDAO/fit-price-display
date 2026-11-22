import test from 'node:test';
import assert from 'node:assert/strict';
import { createB2Storage, getMediaStorage } from '../src/storage.js';

const config = {
  B2_ENDPOINT: 'https://s3.us-west-004.backblazeb2.com',
  B2_BUCKET: 'flyinfinity-social-media-test',
  B2_KEY_ID: 'test-key-id',
  B2_APPLICATION_KEY: 'test-application-key'
};

test('B2 storage remains optional until all credentials are configured', () => {
  assert.equal(getMediaStorage({}), null);
  assert.throws(() => createB2Storage({ B2_ENDPOINT: config.B2_ENDPOINT }), /not fully configured/);
});

test('B2 adapter accepts only the official HTTPS S3 endpoint shape', () => {
  assert.throws(() => createB2Storage({ ...config, B2_ENDPOINT: 'http://s3.us-west-004.backblazeb2.com' }), /HTTPS S3 endpoint/);
  assert.throws(() => createB2Storage({ ...config, B2_ENDPOINT: 'https://example.com' }), /HTTPS S3 endpoint/);
});

test('B2 adapter uploads objects to the configured bucket with expected metadata', async () => {
  const calls = [];
  const fakeClient = { send: async command => { calls.push(command); return {}; } };
  const storage = createB2Storage(config, fakeClient);
  await storage.put('uploads/test.png', new Uint8Array([1, 2, 3]), {
    contentType: 'image/png',
    cacheControl: 'public, max-age=3600',
    metadata: { owner: '0xabc', mediaType: 'image' }
  });
  assert.equal(calls[0].constructor.name, 'PutObjectCommand');
  assert.equal(calls[0].input.Bucket, config.B2_BUCKET);
  assert.equal(calls[0].input.Key, 'uploads/test.png');
  assert.equal(calls[0].input.ContentType, 'image/png');
  assert.deepEqual(calls[0].input.Metadata, { owner: '0xabc', mediaType: 'image' });
});

test('B2 adapter streams private object downloads and returns ETags', async () => {
  const bodyStream = new Response(new Uint8Array([4, 5, 6])).body;
  const calls = [];
  const fakeClient = {
    send: async command => {
      calls.push(command);
      return { Body: { transformToWebStream: () => bodyStream }, ETag: '"abc123"' };
    }
  };
  const storage = createB2Storage(config, fakeClient);
  const object = await storage.get('uploads/test.png');
  assert.equal(calls[0].constructor.name, 'GetObjectCommand');
  assert.equal(calls[0].input.Bucket, config.B2_BUCKET);
  assert.equal(object.body, bodyStream);
  assert.equal(object.httpEtag, '"abc123"');
});

test('B2 adapter returns null for missing objects and deletes only the requested key', async () => {
  const calls = [];
  const fakeClient = {
    send: async command => {
      calls.push(command);
      if (command.constructor.name === 'GetObjectCommand') {
        const error = new Error('missing');
        error.name = 'NoSuchKey';
        throw error;
      }
      return {};
    }
  };
  const storage = createB2Storage(config, fakeClient);
  assert.equal(await storage.get('uploads/missing.png'), null);
  await storage.delete('uploads/old.png');
  assert.equal(calls[1].constructor.name, 'DeleteObjectCommand');
  assert.equal(calls[1].input.Key, 'uploads/old.png');
});
