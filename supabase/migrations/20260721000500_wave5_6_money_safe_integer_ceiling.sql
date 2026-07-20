-- Fix: cap every money column at a value comfortably below
-- Number.MAX_SAFE_INTEGER (2^53 = 9_007_199_254_740_992).
--
-- ADR 0008. Found while building modules/projects: PostgREST/supabase-js
-- serialise bigint as a bare JSON number, and a value above 2^53 is already
-- wrong by the time it reaches JSON.parse inside supabase-js -- verified
-- directly (9007199254740993 in, 9007199254740992 out, no error anywhere).
-- toRupiah() cannot catch this after the fact: the corrupted value is a
-- perfectly valid safe integer on its own terms. The only real fix is a
-- database-level ceiling that keeps a value from ever getting that large in
-- the first place -- ARCHITECTURE.md 0.2's two-layer enforcement, applied to
-- the one gap application-level discipline alone cannot reach.
--
-- 999_999_999_999_999 (999.999 trillion rupiah) is comfortably above any
-- plausible single contract or milestone and comfortably below the 2^53
-- boundary. Every money column introduced from here on must carry the same
-- constraint from its first migration, not have it added later.

alter table contracts
  add constraint ck_contracts_amount_safe_integer check (contract_amount <= 999999999999999);

alter table milestones
  add constraint ck_milestones_amount_safe_integer check (amount <= 999999999999999);
