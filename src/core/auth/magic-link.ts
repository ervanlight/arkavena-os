'use server';

import { z } from 'zod';
import { createServerSupabase } from '@/core/db/client.server';
import { siteUrl } from '@/core/db/env';
import { ERROR_CODES } from '@/core/errors/codes';
import { actionFail, actionOk, type ActionResult } from '@/core/errors/handle';
import { logger } from '@/core/logging/logger';

/**
 * Magic link sign-in -- the only way into this system (owner decision D4).
 *
 * Every role uses it: office, field, client, partner. There is no password
 * anywhere and no SMS or WhatsApp OTP, because OTP costs money per message and
 * D4 chose the zero-cost path.
 *
 * The known risk, recorded in ADR 0003 so it is not forgotten: this assumes
 * every site supervisor has an email account they can open on their phone. That
 * assumption is untested against real field conditions and does not get tested
 * until CHECKPOINT #3. If it fails there, it is an architecture revision.
 */

const requestSchema = z.object({
  email: z.string().trim().toLowerCase().email('Alamat email tidak valid'),
});

/**
 * Send a sign-in link.
 *
 * This deliberately does **not** use safeAction. safeAction requires a signed-in
 * caller, and this is the action a person takes precisely because they are not
 * signed in yet.
 *
 * It also always reports success, whether or not the address belongs to a user.
 * Different responses for known and unknown addresses turn this form into a way
 * to discover who works for the company -- and the client list is exactly the
 * sort of thing a competitor would enjoy. The real outcome goes to the log.
 */
export async function requestMagicLink(formData: FormData): Promise<ActionResult<{ email: string }>> {
  const parsed = requestSchema.safeParse({ email: formData.get('email') });

  if (!parsed.success) {
    return actionFail(ERROR_CODES.VALIDATION_FAILED, 'Alamat email tidak valid.', { field: 'email' });
  }

  const { email } = parsed.data;
  const supabase = await createServerSupabase();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Provisioning is deliberate, not self-service: someone with no profile
      // row would sign in successfully and then have no organisation, which is
      // a worse experience than not being able to sign in.
      shouldCreateUser: false,
      emailRedirectTo: `${siteUrl()}/auth/callback`,
    },
  });

  if (error !== null) {
    // Rate limiting is the one failure worth telling the user about, because
    // the remedy is simply to wait.
    if (error.status === 429) {
      logger.warn('auth.magic_link.rate_limited', { email });
      return actionFail(ERROR_CODES.RATE_LIMITED, 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.');
    }

    logger.warn('auth.magic_link.failed', { email, message: error.message, status: error.status });
    // Still reported as success. See the note above.
    return actionOk({ email });
  }

  logger.info('auth.magic_link.sent', { email });
  return actionOk({ email });
}

/** Sign out and clear the session cookies. */
export async function signOut(): Promise<ActionResult<null>> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  return actionOk(null);
}
