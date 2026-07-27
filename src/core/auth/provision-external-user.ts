import 'server-only';
import { createAdminSupabase, type AdminSupabase } from '@/core/db/admin.server';
import { ConflictError, ValidationError } from '@/core/errors/app-error';
import { generateTemporaryPassword } from './generate-temporary-password';

export type ProvisionedUser = {
  userId: string;
  email: string;
  temporaryPassword: string | null;
};

/**
 * Normalizes input string to a valid email format.
 * If user enters "budi" or "klien1", turns it into "budi@arkavena.com".
 */
export function normalizeUserEmail(rawInput: string): string {
  let email = rawInput.trim().toLowerCase();
  if (!email.includes('@')) {
    email = `${email}@arkavena.com`;
  }
  return email;
}

/**
 * Robust email lookup in Supabase Auth across paginated results
 */
async function findAuthUserByEmail(admin: AdminSupabase, email: string) {
  const target = email.toLowerCase();
  let page = 1;
  while (page <= 10) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (!data?.users || data.users.length === 0) break;
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return found;
    if (data.users.length < 100) break;
    page++;
  }
  return null;
}

/**
 * Provisions an external user (client, subcontractor, pengawas).
 * Can accept a custom password or auto-generate one.
 * Stores the password in managed_password so Admin/CS can view & manage credentials anytime.
 */
export async function provisionExternalUser(input: {
  organizationId: string;
  email: string;
  fullName: string;
  customPassword?: string | null | undefined;
}): Promise<ProvisionedUser> {
  const admin = createAdminSupabase();
  const email = normalizeUserEmail(input.email);
  const activePassword = input.customPassword && input.customPassword.trim().length > 0
    ? input.customPassword.trim()
    : generateTemporaryPassword();

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

    // Update password in Auth & managed_password in DB if a custom password was provided
    if (input.customPassword) {
      await admin.auth.admin.updateUserById(existing.id, { password: activePassword });
      await admin.from('users').update({ managed_password: activePassword }).eq('id', existing.id);
    }

    return { userId: existing.id, email, temporaryPassword: activePassword };
  }

  // 2. User not in public.users -> create in auth.users
  let userId: string | null = null;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: activePassword,
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
      // User exists in Supabase Auth, find via paginated search
      const authUser = await findAuthUserByEmail(admin, email);
      if (authUser) {
        userId = authUser.id;
        // Update password for existing Auth user
        await admin.auth.admin.updateUserById(userId, { password: activePassword });
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
  }

  // 3. Upsert into public.users with managed_password
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
        managed_password: activePassword,
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
    email,
    temporaryPassword: activePassword,
  };
}

/**
 * Resets user password (updates Auth + managed_password column in public.users)
 */
export async function adminResetUserPassword(userId: string, newPassword: string): Promise<void> {
  const admin = createAdminSupabase();
  const { error: authError } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
  if (authError !== null) {
    throw new ValidationError(`Failed to update auth password: ${authError.message}`, {
      userMessage: `Gagal memperbarui password: ${authError.message}`,
    });
  }
  await admin.from('users').update({ managed_password: newPassword }).eq('id', userId);
}

/**
 * Permanently deletes user account from project_members, public.users, and auth.users
 */
export async function adminDeleteUserAccount(userId: string): Promise<void> {
  const admin = createAdminSupabase();
  await admin.from('project_members').delete().eq('user_id', userId);
  await admin.from('users').delete().eq('id', userId);
  await admin.auth.admin.deleteUser(userId);
}
