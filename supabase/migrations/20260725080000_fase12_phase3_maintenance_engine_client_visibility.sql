-- Phase 3 milestone 3.1 (F4): client-facing handover/warranty/service-ticket
-- visibility, per ADR 0026 §5's maintenance-engine row -- "Client Visible
-- (info garansi & status tiket servis milik klien)". maintenance-engine is
-- not one of the two modules ARCHITECTURE.md 1.2 (F25) forbids client-portal
-- from importing directly (only cash-gate/estimating are), so this phase's
-- client-facing reads/writes go straight through modules/maintenance-engine's
-- own public API, the same shape modules/billing's invoice visibility (F3)
-- already uses -- no client_decisions-style mirror table needed for these
-- four tables.
--
-- warranties and handover_items already carry project_id -- their client
-- policies mirror proposals_select_client exactly. assets and service_tickets
-- carry no project_id at all (only site_id/client_id, since a Facility
-- Passport deliberately outlives any single project, Wave 9's own header
-- comment) -- fn_has_project_role cannot express that, hence
-- fn_client_has_role_for_client below, the client_id-scoped equivalent.

create or replace function fn_client_has_role_for_client(p_client_id uuid, p_roles text[])
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  return exists (
    select 1
    from project_members pm
    join projects p on p.id = pm.project_id
    where p.client_id = p_client_id
      and pm.user_id = (select auth.uid())
      and pm.project_role = any(p_roles::project_role[])
  );
end;
$$;

comment on function fn_client_has_role_for_client(uuid, text[]) is
  'The client_id-scoped equivalent of fn_has_project_role, for tables that outlive a single project (assets, service_tickets -- Facility Passport, ADR 0019 SS1). A client holds their role via project_members on some project belonging to this client, not directly on the asset/ticket itself.';

-- warranties: a client sees their own project's warranty status/terms, never draft/internal fields (there are none on this table -- title/starts_at/ends_at/terms/status are all client-appropriate as-is).
create policy warranties_select_client
  on warranties for select
  to authenticated
  using (fn_has_project_role(project_id, array['client_approver', 'client_viewer']));

-- handover_items: what was actually handed over (WORKFLOW_REVIEW.md 7.2's gap). Read-only for the client -- no client update/insert policy, matching this table's existing "staff records history, never edits it" discipline.
create policy handover_items_select_client
  on handover_items for select
  to authenticated
  using (fn_has_project_role(project_id, array['client_approver', 'client_viewer']));

-- assets: minimal context so a client can tell which asset they're reporting a service issue about (name/category/manufacturer/model -- no cost, no vendor pricing, none exist on this table).
create policy assets_select_client
  on assets for select
  to authenticated
  using (fn_client_has_role_for_client(client_id, array['client_approver', 'client_viewer']));

-- service_tickets: a client sees their own reported tickets and can open a
-- new one (WORKFLOW_REVIEW.md 8.2's "duplicate entry" gap -- the schema
-- already anticipated this: reported_by nullable, client_id required).
-- client_viewer may only read; client_approver may also insert (create) --
-- reporting an issue is an action, not a passive view.
create policy service_tickets_select_client
  on service_tickets for select
  to authenticated
  using (fn_client_has_role_for_client(client_id, array['client_approver', 'client_viewer']));

create policy service_tickets_insert_client
  on service_tickets for insert
  to authenticated
  with check (
    fn_client_has_role_for_client(client_id, array['client_approver'])
    and status = 'open'
    and reported_by = (select auth.uid())
    and assigned_to is null
    and maintenance_plan_id is null
    and warranty_id is null
    and resolved_at is null
  );

comment on policy service_tickets_insert_client on service_tickets is
  'A client-reported ticket always starts open, reported_by themselves, unassigned, unresolved, and not linked to a maintenance plan (that link only exists for staff-scheduled recurring inspections, ADR 0019 SS7) -- the with check clause is the column-level restriction RLS alone would not otherwise express for an INSERT.';
