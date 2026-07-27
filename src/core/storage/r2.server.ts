import 'server-only';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? '';
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? '';

const isConfigured = R2_ACCOUNT_ID !== '' && R2_ACCESS_KEY_ID !== '' && R2_SECRET_ACCESS_KEY !== '' && R2_BUCKET_NAME !== '';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Generate a short-lived URL for the client to directly upload a file to Cloudflare R2
 * Bypasses our Vercel server for massive bandwidth savings.
 */
export async function getUploadPresignedUrl(path: string, contentType: string = 'image/webp', expiresIn: number = 3600): Promise<string> {
  if (!isConfigured) {
    throw new Error('R2_ACCOUNT_ID or other R2 credentials are missing in .env.local');
  }

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: path,
    ContentType: contentType,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Generate a short-lived URL to view a private file securely.
 */
export async function getDownloadPresignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
  if (!isConfigured) {
    // If not configured, just return a dummy string or throw error depending on how gracefully we want to handle it.
    // For now, return a placeholder so the app doesn't crash while user is setting up keys.
    return `https://placeholder-url.com/${path}?missing_r2_keys=true`;
  }

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: path,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}
