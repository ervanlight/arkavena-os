/**
 * Storage path convention for the `photos` bucket: `{organizationId}/
 * {projectId}/{zoneId}/{date}/{filename}`. Not incidental -- the RLS
 * policies on `storage.objects` (migration 20260722000200) parse these
 * exact segments via `storage.foldername(name)` to scope access the same
 * way the `photos` table's own RLS does (staff org-wide, site_coordinator/
 * mandor per project). Changing this shape means changing those policies
 * too.
 */

export function photoStoragePath(input: {
  organizationId: string;
  projectId: string;
  zoneId: string;
  date: string; // YYYY-MM-DD
  photoId: string;
}): string {
  return `${input.organizationId}/${input.projectId}/${input.zoneId}/${input.date}/${input.photoId}.jpg`;
}

export function photoThumbnailStoragePath(input: {
  organizationId: string;
  projectId: string;
  zoneId: string;
  date: string;
  photoId: string;
}): string {
  return `${input.organizationId}/${input.projectId}/${input.zoneId}/${input.date}/${input.photoId}-thumb.jpg`;
}
