import 'server-only';
import { createAdminSupabase } from '@/core/db/admin.server';
import { ConflictError } from '@/core/errors/app-error';

/**
 * Creates the `auth.users`/`public.users` rows an external contact (client,
 * supplier, subcontractor) needs before they can ever sign in -- magic link
 * deliberately never self-provisions (`shouldCreateUser: false`,
 * `core/auth/magic-link.ts`), so someone has to write these rows first.
 *
 * Written from Fase 1 (`core/db/admin.server.ts`'s own docstring names
 * exactly this use), never actually called until Fase 11's supplier invite
 * flow needed it for real (ADR 0024 SS6) -- every prior phase's external
 * roles (client_approver, mandor, ...) were provisioned only by test
 * factories using the service-role client directly, never through a real
 * feature. Written here as a standalone, reusable helper rather than
 * `inviteVendorUserAction`-specific, so client/mandor onboarding UI can call
 * it later without redesign.
 *
 * `public.users.email` is unique across the whole table, not per
 * organization (`uq_users_email`, no organization_id in the index) -- this
 * system does not support one email belonging to two different
 * organizations. Re-inviting the same email within the same org reuses the
 * existing row; an email already claimed by a *different* org is a real
 * conflict, surfaced rather than silently reused (would otherwise let this
 * org's vendor_users/project_members link to a user outside its tenant
 * boundary, D1).
 */
export async function provisionExternalUser(input: {
  organizationId: string;
  email: string;
  fullName: string;
}): Promise<string> {
  const admin = createAdminSupabase();
  const email = input.email.trim().toLowerCase();

  const { data: existing, error: existingError } = await admin
    .from('users')
    .select('id, organization_id')
    .ilike('email', email)
    .is('deleted_at', null)
    .maybeSingle();
  if (existingError !== null) throw existingError;

  if (existing !== null) {
    if (existing.organization_id !== input.organizationId) {
      throw new ConflictError(`Email ${email} is already registered under a different organization`, {
        userMessage: 'Alamat email ini sudah terdaftar untuk organisasi lain.',
        meta: { email },
      });
    }
    return existing.id;
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (createError !== null) throw createError;

  const { data: inserted, error: insertError } = await admin
    .from('users')
    .insert({
      id: created.user.id,
      organization_id: input.organizationId,
      email,
      full_name: input.fullName,
      org_role: null,
      status: 'invited',
    })
    .select('id')
    .single();
  if (insertError !== null) throw insertError;

  return inserted.id;
}
