import 'server-only';
import { createAdminSupabase } from '@/core/db/admin.server';
import { ConflictError, ValidationError } from '@/core/errors/app-error';
import { generateTemporaryPassword } from './generate-temporary-password';

export type ProvisionedUser = {
  userId: string;
  /** Only set when a new account was actually created -- null when an existing row was reused, since re-provisioning must never silently change an existing password. */
  temporaryPassword: string | null;
};

/**
 * Creates the `auth.users`/`public.users` rows an external contact (client,
 * supplier, subcontractor) needs before they can ever sign in. Sign-in itself
 * deliberately never self-provisions (ADR 0025 SS1: no sign-up form anywhere),
 * so someone has to write these rows first.
 */
export async function provisionExternalUser(input: {
  organizationId: string;
  email: string;
  fullName: string;
}): Promise<ProvisionedUser> {
  const admin = createAdminSupabase();
  const email = input.email.trim().toLowerCase();

  // 1. Check if user exists in public.users
  const { data: existing, error: existingError } = await admin
    .from('users')
    .select('id, organization_id')
    .ilike('email', email)
    .is('deleted_at', null)
    .maybeSingle();

  if (existingError !== null) {
    throw new ValidationError(`Failed to query users: ${existingError.message}`, {
      userMessage: 'Terjadi kesalahan saat memeriksa data pengguna.',
    });
  }

  if (existing !== null) {
    if (existing.organization_id !== input.organizationId) {
      throw new ConflictError(`Email ${email} is already registered under a different organization`, {
        userMessage: 'Alamat email ini sudah terdaftar untuk organisasi lain.',
        meta: { email },
      });
    }
    return { userId: existing.id, temporaryPassword: null };
  }

  // 2. User not in public.users -> create in auth.users
  const temporaryPassword = generateTemporaryPassword();
  let userId: string | null = null;
  let isNewAuthUser = false;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
  });

  if (createError !== null) {
    const msg = createError.message?.toLowerCase() ?? '';
    const isAlreadyExists =
      msg.includes('already') ||
      msg.includes('registered') ||
      msg.includes('exists') ||
      (createError as { status?: number }).status === 422;

    if (isAlreadyExists) {
      // User exists in Supabase Auth, but was missing from public.users
      const { data: listData } = await admin.auth.admin.listUsers();
      const authUser = listData?.users?.find((u) => u.email?.toLowerCase() === email);
      if (authUser) {
        userId = authUser.id;
      } else {
        throw new ValidationError(`Email ${email} already registered in Auth`, {
          userMessage: `Email ${email} sudah terdaftar di sistem Auth.`,
        });
      }
    } else {
      throw new ValidationError(`Failed to create auth user: ${createError.message}`, {
        userMessage: `Gagal membuat akun authentication: ${createError.message}`,
      });
    }
  } else {
    userId = created.user.id;
    isNewAuthUser = true;
  }

  // 3. Upsert into public.users
  const { data: inserted, error: insertError } = await admin
    .from('users')
    .upsert(
      {
        id: userId,
        organization_id: input.organizationId,
        email,
        full_name: input.fullName,
        org_role: null,
        status: 'invited',
      },
      { onConflict: 'id' },
    )
    .select('id')
    .single();

  if (insertError !== null) {
    throw new ValidationError(`Failed to insert public user: ${insertError.message}`, {
      userMessage: `Gagal menyimpan profil pengguna: ${insertError.message}`,
    });
  }

  return {
    userId: inserted.id,
    temporaryPassword: isNewAuthUser ? temporaryPassword : null,
  };
}
