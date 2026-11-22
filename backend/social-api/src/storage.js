import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';

const REQUIRED = ['B2_ENDPOINT', 'B2_BUCKET', 'B2_KEY_ID', 'B2_APPLICATION_KEY'];
let cachedConfigKey = '';
let cachedStorage = null;

function readConfig(env) {
  const values = REQUIRED.map(name => String(env?.[name] || '').trim());
  if (values.every(value => !value)) return null;
  if (values.some(value => !value)) {
    throw new Error('Backblaze B2 storage is not fully configured');
  }
  let endpoint;
  try {
    const endpointValue = values[0];
    const hasScheme = endpointValue.startsWith('https://') || endpointValue.startsWith('http://');
    endpoint = new URL(hasScheme ? endpointValue : 'https://' + endpointValue);
  } catch {
    throw new Error('Backblaze B2 endpoint is invalid');
  }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password ||
      !/^s3\.[a-z0-9-]+\.backblazeb2\.com$/i.test(endpoint.hostname) ||
      endpoint.pathname !== '/' || endpoint.search || endpoint.hash) {
    throw new Error('Backblaze B2 endpoint must be the HTTPS S3 endpoint shown in bucket details');
  }
  const region = endpoint.hostname.split('.')[1];
  const bucket = values[1];
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) || bucket.includes('..')) {
    throw new Error('Backblaze B2 bucket name is invalid');
  }
  return {
    endpoint: endpoint.origin,
    bucket,
    region,
    keyId: values[2],
    applicationKey: values[3]
  };
}

export function createB2Storage(env, clientOverride = null) {
  const config = readConfig(env);
  if (!config) return null;
  const client = clientOverride || new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.keyId,
      secretAccessKey: config.applicationKey
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED'
  });

  return {
    async put(key, body, options = {}) {
      await client.send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: body instanceof ArrayBuffer ? new Uint8Array(body) : body,
        ContentType: options.contentType,
        CacheControl: options.cacheControl,
        Metadata: options.metadata
      }));
    },
    async get(key) {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
        if (!result.Body) return null;
        const body = typeof result.Body.transformToWebStream === 'function'
          ? result.Body.transformToWebStream()
          : result.Body;
        if (!(body instanceof ReadableStream)) {
          throw new Error('Backblaze B2 returned an unsupported object stream');
        }
        return { body, httpEtag: result.ETag || null };
      } catch (error) {
        if (error?.name === 'NoSuchKey' || error?.name === 'NotFound' ||
            error?.$metadata?.httpStatusCode === 404) return null;
        throw error;
      }
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    }
  };
}

export function getMediaStorage(env) {
  const config = readConfig(env);
  if (!config) return null;
  const cacheKey = [config.endpoint, config.bucket, config.region, config.keyId, config.applicationKey].join('\u0000');
  if (cacheKey !== cachedConfigKey || !cachedStorage) {
    cachedStorage = createB2Storage(env);
    cachedConfigKey = cacheKey;
  }
  return cachedStorage;
}
