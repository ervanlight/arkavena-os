/**
 * Phase 3 (F17): the standard assessment checklist. Config-as-code, not
 * per-organization-customizable data (WORKFLOW_REVIEW.md 1.2's gap is
 * consistency across assessors, not flexibility) -- a fixed list every
 * assessor sees the same way, every time.
 */

export const STANDARD_ASSESSMENT_CHECKLIST_ITEMS = [
  { key: 'site_access_confirmed', label: 'Akses lokasi sudah dikonfirmasi' },
  { key: 'existing_structure_condition', label: 'Kondisi struktur eksisting diperiksa' },
  { key: 'utilities_verified', label: 'Utilitas (listrik/air/gas) diverifikasi' },
  { key: 'measurements_taken', label: 'Pengukuran lokasi sudah diambil' },
  { key: 'client_requirements_documented', label: 'Kebutuhan klien terdokumentasi' },
  { key: 'photos_captured', label: 'Foto lokasi sudah diambil' },
] as const;

export type AssessmentChecklistItemKey = (typeof STANDARD_ASSESSMENT_CHECKLIST_ITEMS)[number]['key'];
export type AssessmentChecklistResponses = Partial<Record<AssessmentChecklistItemKey, boolean>>;
