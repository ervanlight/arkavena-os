'use server';

import { z } from 'zod';
import { safeAction } from '@/core/actions/safe-action';
import { getActionContext } from '@/core/auth/session';
import { getUploadPresignedUrl } from '@/core/storage/r2.server';

export const getUploadPresignedUrlAction = safeAction(
  {
    name: 'storage.getUploadPresignedUrl',
    schema: z.object({
      path: z.string().min(1),
      contentType: z.string().default('image/webp'),
    }),
    permission: { resource: 'photo', action: 'create' }, // Using photo create permission as a baseline
    loadContext: getActionContext,
  },
  async ({ path, contentType }, _ctx): Promise<{ url: string }> => {
    // Generate a secure, short-lived upload URL to Cloudflare R2
    const url = await getUploadPresignedUrl(path, contentType, 60 * 15); // 15 mins expiry
    return { url };
  },
);
