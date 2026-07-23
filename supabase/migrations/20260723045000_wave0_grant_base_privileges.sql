-- Every migration in this project has only ever restricted access further
-- with RLS, on the assumption that anon/authenticated/service_role already
-- hold base GRANTs on the public schema -- true on Supabase Cloud (this
-- project's dev database, ADR 0006), where the platform's own project
-- bootstrap issues these grants outside any migration file the moment a
-- project is created. A from-scratch local `supabase start` (used by CI)
-- never runs that platform-level bootstrap: it gets a plain Postgres
-- instance plus the auth/storage/realtime schemas, with no equivalent
-- "grant everything in public to the Data API roles" step. Every query
-- against a user-created table therefore fails with `permission denied for
-- table X` (SQLSTATE 42501) before RLS is ever evaluated -- a different
-- failure from an RLS policy correctly denying a row, and one that was
-- invisible until this session's first real CI run against a from-scratch
-- database exercised the actual test suite (supabase/tests/**) rather than
-- just applying migrations.
--
-- Idempotent: re-running this against Supabase Cloud dev, which already has
-- these grants, is a no-op.

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;

-- The blanket grant above would otherwise silently undo audit_logs' own
-- append-only guarantee (20260720000200_wave1_identity_kernel.sql) --
-- restoring it explicitly here rather than assuming grant order protects it.
revoke update, delete on audit_logs from authenticated, anon;
