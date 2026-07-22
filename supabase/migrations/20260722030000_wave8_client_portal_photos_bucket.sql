-- Fase 6: the `photos` storage bucket never got a client-facing read policy
-- (only staff and site_coordinator/mandor, migration 20260722000200) --
-- found while wiring up the portal's "Foto Progres" page: the `photos`
-- table's own new client-scoped policy (photos_select_client, this wave)
-- lets a client see a photo's metadata, but the bucket holding the actual
-- image bytes still refused them. Same two-layer shape ARCHITECTURE.md 0.2
-- already applies everywhere else -- table RLS and Storage RLS are
-- separate and both need the same role added.

create policy photos_bucket_select_client
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'photos'
    and fn_has_project_role((storage.foldername(name))[2]::uuid, array['client_approver', 'client_viewer'])
  );
