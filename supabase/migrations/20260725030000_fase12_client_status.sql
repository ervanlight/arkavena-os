-- Fase 12 (modules/client-portal): Client Project Status (ADR 0026 §2,
-- ADR 0026 §7 item 3 -- publish authority resolved as Owner + Technical
-- Director). Append-only: the "current" status for a project is simply its
-- most recently published row, exactly the same shape client_decisions
-- already uses (no separate mutable "current status" column to keep in
-- sync). No DB view for the client read path -- client_decisions' own
-- precedent (Fase 6, ADR 0016) is a direct RLS policy plus an
-- application-level `order by published_at desc limit 1`, not a view.

create type client_project_status as enum (
  'on_track',
  'waiting_client_decision',
  'external_dependency',
  'schedule_adjustment',
  'completed'
);

create table client_status_updates (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations (id) on delete restrict,
  project_id       uuid not null references projects (id) on delete restrict,
  status           client_project_status not null,
  -- Mandatory per PRODUCT.md's UX philosophy: a status is never shown bare,
  -- always with a short human explanation.
  headline         text not null,
  detail           text,
  published_by     uuid not null references users (id) on delete restrict,
  published_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint ck_client_status_updates_headline_not_blank check (btrim(headline) <> '')
);

create index idx_client_status_updates_organization_id on client_status_updates (organization_id);
-- Supports the exact lookup both the client and staff surfaces need: this
-- project's most recent status.
create index idx_client_status_updates_project_published on client_status_updates (project_id, published_at desc);

comment on table client_status_updates is
  'Owned by modules/client-portal (ADR 0026 §2). Append-only -- the current status for a project is its most recent row. published_by is always a real user (never a system/automatic process, ADR 0026 §2.3: AI may draft headline/detail, but publishing is always a human action).';

alter table client_status_updates enable row level security;

create policy client_status_updates_select_staff
  on client_status_updates for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy client_status_updates_select_client
  on client_status_updates for select
  to authenticated
  using (fn_has_project_role(project_id, array['client_approver', 'client_viewer']));

-- RLS is the coarse filter; requirePermission()'s client_status.publish
-- entry (owner + technical_director only) is the application-layer check.
-- Enforced again here at the DB layer, same two-layer split as every other
-- override/approval in this system.
create policy client_status_updates_insert_publishers
  on client_status_updates for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() in ('owner', 'technical_director'));

select fn_install_standard_triggers('client_status_updates');
