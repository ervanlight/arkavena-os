-- Wave 0, part 1: extensions and enum types.
--
-- ARCHITECTURE.md 2.1 describes Wave 0 as "all ENUM types". This migration
-- creates only the enums the Wave 0-1 objects actually need. Creating enums for
-- tables that do not exist yet would be building ahead of the phase, which
-- CLAUDE.md law 7 forbids; each later wave adds its own enums in its own
-- migration. The rule that matters is the ordering one -- no wave may reference
-- something from a higher wave -- and that still holds.
--
-- Migrations are append-only (CLAUDE.md 2). Nothing in this file is ever edited
-- once applied; corrections come as a new migration.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

-- gen_random_uuid() is built into Postgres 13+, but pgcrypto is created
-- explicitly so the schema does not silently depend on the server version.
create extension if not exists pgcrypto with schema extensions;

-- Trigram search, for name lookups on clients, vendors and projects later.
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Role enums (ARCHITECTURE.md 6.1)
--
-- Two axes, deliberately not merged into one list:
--
--   organisation role -- internal staff, held on users.org_role. One per user.
--   project role      -- anyone, internal or external, held on project_members.
--                        A person can hold different project roles on different
--                        projects, and internal staff can hold one too.
--
-- Merging them would make "which project?" meaningless for staff roles and
-- "which organisation?" meaningless for a client approver.
-- ---------------------------------------------------------------------------

create type org_role as enum (
  'owner',
  'technical_director',
  'finance',
  'qs',
  'procurement'
);

create type project_role as enum (
  'site_coordinator',
  'mandor',
  'client_approver',
  'client_viewer',
  'supplier',
  'subcontractor'
);

-- Which axis a row in the roles reference table belongs to.
create type role_scope as enum ('organization', 'project');

-- ---------------------------------------------------------------------------
-- Kernel status enums
-- ---------------------------------------------------------------------------

create type organization_status as enum ('active', 'suspended');

create type user_status as enum (
  'invited',   -- provisioned, has not signed in yet
  'active',
  'suspended'  -- retained for audit history; cannot sign in
);

-- ---------------------------------------------------------------------------
-- Audit enums (ARCHITECTURE.md 5.2)
--
-- 'status_change' exists separately from 'update' because a status transition
-- is the thing anyone auditing this system actually looks for, and burying it
-- inside generic updates would mean reading every diff to find one.
--
-- 'override' and 'approve' can only be written by the application channel:
-- a database trigger sees a row change, not the human intent behind it.
-- ---------------------------------------------------------------------------

create type audit_action as enum (
  'insert',
  'update',
  'status_change',
  'delete',
  'approve',
  'reject',
  'override',
  'login'
);

create type audit_source as enum (
  'app',      -- written by core/audit, carries reason and request_id
  'trigger',  -- written by fn_audit_row_change, the safety net
  'system'    -- background jobs
);

-- ---------------------------------------------------------------------------
-- Notification enums
--
-- WhatsApp is absent on purpose. Owner decision D4 chose email magic link over
-- phone/OTP to stay at zero cost, and D9 keeps us on free tiers; adding a paid
-- channel here would quietly contradict both.
-- ---------------------------------------------------------------------------

create type notification_channel as enum ('in_app', 'email');

create type notification_status as enum ('pending', 'sent', 'read', 'failed');
