-- ADR 0011 (contract step): drop the old risk_reserve_amount column from
-- projects now that project_risk_reserves (20260721000800) is the sole
-- source -- fn_cash_gate_status was already repointed there in that same
-- migration, and no application code reads or writes this column anymore.

alter table projects drop constraint ck_projects_risk_reserve_safe_integer;
alter table projects drop constraint ck_projects_risk_reserve_non_negative;
alter table projects drop column risk_reserve_amount;
