import test from 'node:test';
import assert from 'node:assert/strict';
import { IMAGE_MODEL, generateImage } from '../src/image-provider.js';

const PNG_BASE64 = Buffer.from([
  137, 80, 78, 71, 13, 10, 26, 10,
  0, 0, 0, 0
]).toString('base64');

test('calls FLUX.2 Klein 4B with a 512 square output and a supplied seed', async () => {
  let call;
  const result = await generateImage({
    ai: {
      async run(model, input) {
        call = { model, input };
        return { image: PNG_BASE64 };
      }
    },
    prompt: '  A gold and turquoise abstract technology image  ',
    seed: 42
  });

  assert.equal(call.model, IMAGE_MODEL);
  assert.deepEqual(call.input, {
    prompt: 'A gold and turquoise abstract technology image',
    width: 512,
    height: 512,
    seed: 42
  });
  assert.equal(result.contentType, 'image/png');
  assert.equal(result.seed, 42);
  assert.deepEqual(Array.from(result.bytes.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
});

test('omits an invalid seed instead of forwarding it to the model', async () => {
  let call;
  await generateImage({
    ai: {
      async run(model, input) {
        call = { model, input };
        return { image: PNG_BASE64 };
      }
    },
    prompt: 'A calm forest at dawn',
    seed: -1
  });
  assert.equal(Object.hasOwn(call.input, 'seed'), false);
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
