-- Demo organisations and users. Development and staging only -- never
-- production (ARCHITECTURE.md 2.5).
--
-- Two organisations, not one. A single-tenant seed makes org isolation
-- untestable by eye: every query looks correct when there is nothing to leak
-- from. With a second organisation present, a broken RLS policy shows up the
-- first time someone opens the app, not in production.
--
-- Automated tests do not read this file. They build their own data through
-- supabase/tests/factories.ts, so no test depends on a seed row someone edited.
--
-- Sign-in is email magic link (owner decision D4). Locally, Supabase captures
-- the emails -- open http://127.0.0.1:54324 to click the link. There are no
-- passwords here because the system has none.

-- ---------------------------------------------------------------------------
-- Fixed UUIDs, so re-running the seed is idempotent and so a developer can
-- refer to a known id while debugging.
-- ---------------------------------------------------------------------------

insert into organizations (id, name, slug) values
  ('00000000-0000-4000-8000-000000000001', 'BuildTrust Demo', 'buildtrust-demo'),
  -- Exists to be the organisation you must never be able to see from the first.
  ('00000000-0000-4000-8000-000000000002', 'Kontraktor Sebelah', 'kontraktor-sebelah')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- auth.users rows.
--
-- Normally Supabase Auth creates these. Seeding them directly gives us known
-- accounts whose profile rows already exist, so the first magic link sign-in
-- lands on a working org context instead of a user with no organisation.
--
-- encrypted_password is empty on purpose: these accounts have no password and
-- cannot be signed into with one.
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-9000-000000000001',
   'authenticated', 'authenticated', 'owner@demo.test',
   '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),

  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-9000-000000000002',
   'authenticated', 'authenticated', 'finance@demo.test',
   '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),

  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-9000-000000000003',
   'authenticated', 'authenticated', 'lapangan@demo.test',
   '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),

  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-9000-000000000004',
   'authenticated', 'authenticated', 'owner@sebelah.test',
   '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Profiles.
--
-- lapangan@demo.test has org_role NULL on purpose: a site coordinator is a
-- project role, not an organisation role (ARCHITECTURE.md 6.1). Until Wave 4
-- brings project_members, that account can sign in and belongs to the
-- organisation but holds no internal role -- which is exactly right, and is
-- also the account that proves the audit trail stays invisible to non-staff.
-- ---------------------------------------------------------------------------

insert into users (id, organization_id, email, full_name, org_role, status) values
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000001',
   'owner@demo.test', 'Budi Santoso', 'owner', 'active'),

  ('00000000-0000-4000-9000-000000000002', '00000000-0000-4000-8000-000000000001',
   'finance@demo.test', 'Sri Wahyuni', 'finance', 'active'),

  ('00000000-0000-4000-9000-000000000003', '00000000-0000-4000-8000-000000000001',
   'lapangan@demo.test', 'Agus Prasetyo', null, 'active'),

  ('00000000-0000-4000-9000-000000000004', '00000000-0000-4000-8000-000000000002',
   'owner@sebelah.test', 'Rina Kartika', 'owner', 'active')
on conflict (id) do nothing;
