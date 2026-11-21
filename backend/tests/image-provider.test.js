import test from 'node:test';
import assert from 'node:assert/strict';
import { IMAGE_MODEL, generateImage } from '../src/image-provider.js';

const PNG_BASE64 = Buffer.from([
  137, 80, 78, 71, 13, 10, 26, 10,
  0, 0, 0, 0
]).toString('base64');

test('calls FLUX.2 Klein 4B with documented multipart input and a supplied seed', async () => {
  let call;
  const result = await generateImage({
    ai: {
      async run(model, input) {
        call = { model, input };
        const request = new Request('https://test.invalid', {
          method: 'POST',
          body: input.multipart.body,
          headers: { 'Content-Type': input.multipart.contentType }
        });
        const form = await request.formData();
        assert.equal(form.get('prompt'), 'A gold and turquoise abstract technology image');
        assert.equal(form.get('width'), '512');
        assert.equal(form.get('height'), '512');
        assert.equal(form.get('seed'), '42');
        return { image: PNG_BASE64 };
      }
    },
    prompt: '  A gold and turquoise abstract technology image  ',
    seed: 42
  });

  assert.equal(call.model, IMAGE_MODEL);
  assert.equal(typeof call.input.multipart.contentType, 'string');
  assert.match(call.input.multipart.contentType, /^multipart\/form-data; boundary=/);
  assert.equal(result.contentType, 'image/png');
  assert.equal(result.seed, 42);
  assert.deepEqual(Array.from(result.bytes.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
});

test('omits an invalid seed instead of forwarding it to the model', async () => {
  let formData;
  await generateImage({
    ai: {
      async run(model, input) {
        const request = new Request('https://test.invalid', {
          method: 'POST',
          body: input.multipart.body,
          headers: { 'Content-Type': input.multipart.contentType }
        });
        formData = await request.formData();
        return { image: PNG_BASE64 };
      }
    },
    prompt: 'A calm forest at dawn',
    seed: -1
  });
  assert.equal(formData.has('seed'), false);
});

test('fails closed when the Workers AI binding is unavailable', async () => {
  await assert.rejects(
    generateImage({ ai: null, prompt: 'A test image' }),
    /Workers AI binding is not configured/
  );
});

test('rejects malformed or unsupported image output', async () => {
  await assert.rejects(
    generateImage({
      ai: { async run() { return { image: 'not-an-image' }; } },
      prompt: 'A test image'
    }),
    /invalid base64|unsupported image format/
  );
});
