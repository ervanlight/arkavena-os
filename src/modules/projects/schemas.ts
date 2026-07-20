import { z } from 'zod';
import { PROJECT_ROLES } from '@/core/permissions/matrix';

/**
 * A money field as the boundary sees it: digits only, no separators, no
 * decimals -- exactly what `toRupiah` accepts as a string. Capped at 15 digits
 * because that is what ADR 0008's safe-integer ceiling
 * (999_999_999_999_999) is: the largest possible 15-digit value, so any
 * string this regex accepts already satisfies the database CHECK constraint
 * without a separate numeric comparison.
 */
const moneyString = z
  .string()
  .trim()
  .regex(/^\d{1,15}$/, 'Nominal harus angka bulat, tanpa titik/koma, maksimal 15 digit');

export const createProjectSchema = z.object({
  clientId: z.string().uuid('Pilih klien'),
  siteId: z.string().uuid('Pilih lokasi'),
  name: z.string().trim().min(1, 'Nama proyek wajib diisi').max(200),
  startDate: z.string().date().optional(),
  targetEndDate: z.string().date().optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'Nama proyek wajib diisi').max(200).optional(),
  status: z.enum(['planning', 'in_progress', 'on_hold', 'completed', 'cancelled']).optional(),
  startDate: z.string().date().optional(),
  targetEndDate: z.string().date().optional(),
  actualEndDate: z.string().date().optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const addProjectMemberSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  projectRole: z.enum([...PROJECT_ROLES]),
});
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;

export const removeProjectMemberSchema = z.object({
  id: z.string().uuid(),
});
export type RemoveProjectMemberInput = z.infer<typeof removeProjectMemberSchema>;

export const createZoneSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1, 'Nama zona wajib diisi').max(200),
  description: z.string().trim().max(1000).optional(),
});
export type CreateZoneInput = z.infer<typeof createZoneSchema>;

export const updateZoneSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'Nama zona wajib diisi').max(200).optional(),
  description: z.string().trim().max(1000).optional(),
});
export type UpdateZoneInput = z.infer<typeof updateZoneSchema>;

export const createContractSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1, 'Judul kontrak wajib diisi').max(200),
  contractAmount: moneyString,
  signedDate: z.string().date().optional(),
});
export type CreateContractInput = z.infer<typeof createContractSchema>;

export const updateContractSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, 'Judul kontrak wajib diisi').max(200).optional(),
  contractAmount: moneyString.optional(),
  status: z.enum(['draft', 'active', 'completed', 'terminated']).optional(),
  signedDate: z.string().date().optional(),
});
export type UpdateContractInput = z.infer<typeof updateContractSchema>;

export const createMilestoneSchema = z.object({
  contractId: z.string().uuid(),
  name: z.string().trim().min(1, 'Nama milestone wajib diisi').max(200),
  amount: moneyString,
  dueDate: z.string().date().optional(),
});
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;

export const updateMilestoneSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'Nama milestone wajib diisi').max(200).optional(),
  amount: moneyString.optional(),
  status: z.enum(['pending', 'completed']).optional(),
  dueDate: z.string().date().optional(),
});
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;

export const createWorkPackageSchema = z.object({
  projectId: z.string().uuid(),
  zoneId: z.string().uuid().optional(),
  milestoneId: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Nama paket kerja wajib diisi').max(200),
});
export type CreateWorkPackageInput = z.infer<typeof createWorkPackageSchema>;

export const updateWorkPackageSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'Nama paket kerja wajib diisi').max(200).optional(),
  status: z.enum(['not_started', 'in_progress', 'completed']).optional(),
  zoneId: z.string().uuid().optional(),
  milestoneId: z.string().uuid().optional(),
});
export type UpdateWorkPackageInput = z.infer<typeof updateWorkPackageSchema>;
