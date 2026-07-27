'use server';

import { z } from 'zod';
import { createServerSupabase } from '@/core/db/client.server';
import { siteUrl } from '@/core/db/env';
import { ERROR_CODES } from '@/core/errors/codes';
import { actionFail, actionOk, type ActionResult } from '@/core/errors/handle';
import { logger } from '@/core/logging/logger';

/**
 * Email + password sign-in -- every role (ADR 0025, reversing owner decision
 * D4's magic link). Provisioning still creates every account
 * (provision-external-user.ts, invite-staff-user.ts); there is no sign-up
 * form anywhere.
 */

import { normalizeUserEmail } from './provision-external-user';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'ID / Email wajib diisi'),
  password: z.string().min(1, 'Kata sandi wajib diisi'),
});

/**
 * Deliberately does not use safeAction -- safeAction requires a signed-in
 * caller, and this is the action taken precisely because the caller is not
 * signed in yet (same reasoning the magic-link request this replaces used).
 */
export async function signInWithPassword(formData: FormData): Promise<ActionResult<null>> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return actionFail(ERROR_CODES.VALIDATION_FAILED, first?.message ?? 'Data tidak valid', {
      ...(first?.path[0] !== undefined ? { field: String(first.path[0]) } : {}),
    });
  }

  const email = normalizeUserEmail(parsed.data.email);
  const { password } = parsed.data;
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error !== null) {
    if (error.status === 429) {
      logger.warn('auth.password_login.rate_limited', { email });
      return actionFail(ERROR_CODES.RATE_LIMITED, 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.');
    }

    // Same message whether the email has no account or the password is
    // wrong -- distinguishing the two turns this form into a way to discover
    // which addresses have accounts (the reasoning the magic-link form this
    // replaces already applied to unknown addresses).
    logger.warn('auth.password_login.failed', { email, message: error.message, status: error.status });
    return actionFail(ERROR_CODES.UNAUTHENTICATED, 'Email atau kata sandi salah.');
  }

  logger.info('auth.password_login.ok', { email });
  return actionOk(null);
}

/** Sign out and clear the session cookies. */
export async function signOut(): Promise<ActionResult<null>> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  return actionOk(null);
}

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Alamat email tidak valid'),
});

/**
 * Always reports success regardless of whether the address has an account --
 * same reasoning as signInWithPassword's uniform failure message, applied to
 * the request side instead.
 */
export async function requestPasswordReset(formData: FormData): Promise<ActionResult<{ email: string }>> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return actionFail(ERROR_CODES.VALIDATION_FAILED, 'Alamat email tidak valid.', { field: 'email' });
  }

  const { email } = parsed.data;
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=%2Freset-password`,
  });

  if (error !== null) {
    if (error.status === 429) {
      logger.warn('auth.password_reset.rate_limited', { email });
      return actionFail(ERROR_CODES.RATE_LIMITED, 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.');
    }
    logger.warn('auth.password_reset.failed', { email, message: error.message, status: error.status });
  } else {
    logger.info('auth.password_reset.sent', { email });
  }

  return actionOk({ email });
}

const newPasswordSchema = z.object({
  password: z.string().min(8, 'Kata sandi minimal 8 karakter'),
});

/**
 * Sets a new password for the current session. Reached two ways, both of
 * which already have a real Supabase session by the time this runs: a
 * password-recovery link (exchanged by /auth/callback into a session) or a
 * signed-in user changing their own password. Not wrapped in safeAction --
 * Supabase's updateUser only ever affects the caller's own account, and a
 * person mid password-recovery has no organisation context yet for
 * requirePermission to check.
 */
export async function updatePassword(formData: FormData): Promise<ActionResult<null>> {
  const parsed = newPasswordSchema.safeParse({ password: formData.get('password') });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return actionFail(ERROR_CODES.VALIDATION_FAILED, first?.message ?? 'Kata sandi tidak valid', { field: 'password' });
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error !== null) {
    logger.warn('auth.password_update.failed', { message: error.message });
    return actionFail(ERROR_CODES.INTERNAL_ERROR, 'Gagal mengubah kata sandi. Coba lagi.');
  }

  logger.info('auth.password_update.ok', {});
  return actionOk(null);
}
