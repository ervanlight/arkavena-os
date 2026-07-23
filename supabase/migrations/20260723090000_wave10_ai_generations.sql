-- Fase 10 (modules/ai-scribe): ai_generations -- ADR 0020 SS3. The one new
-- table this phase needs: an append-only cost/usage ledger, not a place AI
-- output is reviewed or approved from (ADR 0020 SS2 -- ai-scribe never
-- writes to any other module's table; a generation's suggested text is
-- returned to the caller and saved, if at all, through the owning module's
-- own existing create/update action).

create table ai_generations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  project_id      uuid references projects (id) on delete restrict,
  feature         text not null,
  model           text not null,
  input_tokens    integer not null,
  output_tokens   integer not null,
  cost_amount     bigint not null,
  requested_by    uuid not null references users (id) on delete restrict,
  created_at      timestamptz not null default now(),

  constraint ck_ai_generations_feature_not_blank check (btrim(feature) <> ''),
  constraint ck_ai_generations_tokens_non_negative check (input_tokens >= 0 and output_tokens >= 0),
  constraint ck_ai_generations_cost_non_negative check (cost_amount >= 0),
  constraint ck_ai_generations_cost_safe_integer check (cost_amount <= 999999999999999)
);

create index idx_ai_generations_organization_id on ai_generations (organization_id);
create index idx_ai_generations_project_id on ai_generations (project_id);
-- Supports the budget-cap check's own lookup exactly (org, this calendar month).
create index idx_ai_generations_org_created_at on ai_generations (organization_id, created_at);

comment on table ai_generations is
  'Owned by modules/ai-scribe (ADR 0020 SS3). Append-only cost/usage ledger -- no deleted_at, no UPDATE policy, same "never edited after the fact" shape as audit_logs. project_id is nullable: some features are org-scoped, not project-scoped.';

alter table ai_generations enable row level security;

-- No UPDATE/DELETE policy for anyone -- append-only, mirrors audit_logs.
create policy ai_generations_select_staff
  on ai_generations for select
  to authenticated
  using (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

create policy ai_generations_insert_staff
  on ai_generations for insert
  to authenticated
  with check (organization_id = fn_current_org_id() and fn_current_org_role() is not null);

select fn_install_standard_triggers('ai_generations');
