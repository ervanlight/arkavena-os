-- Fase 12 (ADR 0029 Decision 3): every photo saved via field-reporting's
-- SiteFlow upload automatically gets a matching, internal_only evidence
-- row -- as a DB trigger rather than app-level orchestration, so this can
-- never be forgotten by a future code path that also inserts into `photos`
-- (the same reasoning as fn_change_orders_sync_client_decision, Fase 6, and
-- fn_leads_sync_assessment_project, Fase 8 -- cross-module sync via trigger
-- is this system's proven pattern for "structurally cannot be skipped",
-- stronger than any app-level function call).
--
-- SECURITY DEFINER: a site_coordinator/mandor's own photos insert already
-- has RLS rights on `evidence` too (evidence_insert_field), so this isn't
-- strictly required for permission reasons the way fn_audit_row_change is
-- -- kept anyway for consistency with every other cross-module sync trigger
-- in this system, and so this keeps working unchanged if evidence's RLS
-- policies are ever tightened later.

create or replace function fn_photos_sync_evidence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_activity_table text;
  v_activity_id uuid;
begin
  -- ADR 0029 Decision 3's priority order: work_package_id -> daily_log_id ->
  -- handover_item_id -> skip entirely if only zone_id is set (a general
  -- zone photo isn't evidence for a specific unit of work).
  if new.work_package_id is not null then
    v_activity_table := 'work_packages';
    v_activity_id := new.work_package_id;
  elsif new.daily_log_id is not null then
    v_activity_table := 'daily_logs';
    v_activity_id := new.daily_log_id;
  elsif new.handover_item_id is not null then
    v_activity_table := 'handover_items';
    v_activity_id := new.handover_item_id;
  else
    return new;
  end if;

  insert into evidence (
    organization_id, project_id, activity_table, activity_id, evidence_type,
    storage_path, thumbnail_path, captured_at, responsible_user_id, created_by
  )
  values (
    new.organization_id, new.project_id, v_activity_table, v_activity_id, 'photo',
    new.storage_path, new.thumbnail_path, new.created_at, new.uploaded_by, new.uploaded_by
  );

  return new;
end;
$$;

comment on function fn_photos_sync_evidence() is
  'ADR 0029 Decision 3: creates a matching internal_only evidence row for every photo insert whose work_package_id/daily_log_id/handover_item_id maps to a specific activity. A photo with none of those set (general zone photo) is left as-is -- correct, not a gap.';

create trigger trg_photos_sync_evidence
  after insert on photos
  for each row execute function fn_photos_sync_evidence();
