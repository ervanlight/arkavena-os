-- Fase 4: the `photos` storage bucket, RLS'd the same way the `photos`
-- table itself is (staff org-wide, site_coordinator/mandor per project) --
-- ARCHITECTURE.md 0.2's two-layer principle applies to Storage too, not
-- just Postgres tables.
--
-- Path convention (core/storage/paths.ts): `{organizationId}/{projectId}/
-- {zoneId}/{date}/{filename}` -- storage.foldername(name) splits on '/' and
-- drops the filename, so segment [1] is organizationId, [2] is projectId.
-- Changing the path shape means changing these policies too.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy photos_bucket_select_staff
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1]::uuid = fn_current_org_id()
    and fn_current_org_role() is not null
  );

create policy photos_bucket_select_field
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'photos'
    and fn_has_project_role((storage.foldername(name))[2]::uuid, array['site_coordinator', 'mandor'])
  );

create policy photos_bucket_insert_staff
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1]::uuid = fn_current_org_id()
    and fn_current_org_role() is not null
  );

create policy photos_bucket_insert_field
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'photos'
    and fn_has_project_role((storage.foldername(name))[2]::uuid, array['site_coordinator', 'mandor'])
  );

-- No UPDATE/DELETE policy for anyone: a photo is never edited once
-- uploaded, and removal goes through the `photos` table's own soft delete
-- (deleted_at), same as every other table -- the storage object itself
-- stays in place (cheap at this volume, and keeps "undelete" possible).
