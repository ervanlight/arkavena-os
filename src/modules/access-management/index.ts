/**
 * Public API for access management module.
 * Handles external user account creation and access control:
 * - Subkontraktor (project role: subcontractor)
 * - Pengawas (project role: photo_uploader) — subordinate of subkon
 * - Klien Portal (project role: client_approver / client_viewer)
 */

export {
  listSubkonUsersAction,
  listClientPortalUsersAction,
  listProjectsForAccessAction,
  revokeProjectAccessAction,
  resetUserPasswordAction,
  deleteUserAccountAction,
} from './actions';

export type { ExternalUserWithProjects } from './actions';
