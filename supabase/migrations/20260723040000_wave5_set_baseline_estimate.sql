-- ADR 0018 SS4: "setting a new baseline unsets the previous one in the same
-- transaction" -- same shape as fn_override_and_open_work_package (ADR
-- 0010, Fase 2): a plpgsql function is what actually makes two writes
-- atomic from a single supabase.rpc() call, not two sequential JS awaits
-- (which would leave a transient window, or a crash-recovery gap, between
-- unset and set). No security definer -- RLS and estimates_update_staff
-- still apply to the calling user, this function grants no privilege of
-- its own, identical to fn_override_and_open_work_package's own note.

create or replace function fn_set_baseline_estimate(p_estimate_id uuid)
returns estimates
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_project_id uuid;
  v_estimate estimates;
begin
  select project_id into v_project_id
  from estimates
  where id = p_estimate_id and deleted_at is null;

  if v_project_id is null then
    raise exception 'Estimate % not found', p_estimate_id using errcode = 'no_data_found';
  end if;

  -- Unset any existing baseline for this project first -- by the time the
  -- second statement runs, uq_estimates_one_baseline_per_project never sees
  -- two true rows at once.
  update estimates
  set is_baseline = false
  where project_id = v_project_id
    and is_baseline
    and id <> p_estimate_id
    and deleted_at is null;

  update estimates
  set is_baseline = true
  where id = p_estimate_id
  returning * into v_estimate;

  return v_estimate;
end;
$$;

comment on function fn_set_baseline_estimate(uuid) is
  'ADR 0018 SS4: unsets the project''s previous baseline and sets the new one in one transaction. RLS and estimates_update_staff both still apply to the calling user -- this function grants no privilege of its own.';
