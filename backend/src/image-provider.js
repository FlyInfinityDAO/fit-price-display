export const IMAGE_MODEL = '@cf/black-forest-labs/flux-2-klein-4b';
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function decodeImage(base64) {
  if (typeof base64 !== 'string' || !base64.trim()) {
    throw new Error('Image provider returned an empty result');
  }

  const clean = base64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '').replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 === 1) {
    throw new Error('Image provider returned invalid base64');
  }

  let binary;
  try {
    binary = atob(clean);
  } catch {
    throw new Error('Image provider returned invalid base64');
  }
  if (!binary.length || binary.length > MAX_IMAGE_BYTES) {
    throw new Error('Generated image is empty or exceeds the allowed size');
  }

  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  let contentType;
  if (bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 &&
      bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10) {
    contentType = 'image/png';
  } else if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    contentType = 'image/jpeg';
  } else if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') {
    contentType = 'image/webp';
  } else {
    throw new Error('Image provider returned an unsupported image format');
  }

  return { bytes, contentType };
}

export async function generateImage({ ai, prompt, seed }) {
  if (!ai || typeof ai.run !== 'function') {
    throw new Error('Workers AI binding is not configured');
  }
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('A valid image prompt is required');
  }

  const input = { prompt: prompt.trim(), width: 512, height: 512 };
  if (Number.isInteger(seed) && seed >= 0 && seed <= 2147483647) {
    input.seed = seed;
  }

  const result = await ai.run(IMAGE_MODEL, input);
  const image = decodeImage(result?.image);
  return { ...image, model: IMAGE_MODEL, seed: input.seed ?? null };
}
