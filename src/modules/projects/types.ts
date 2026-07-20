import type { Rupiah } from '@/core/money/rupiah';
import type { Tables, TablesInsert, TablesUpdate } from '@/core/db/database.types';

/** Row types always derive from the generated schema (ARCHITECTURE.md 3.1). */

export type Project = Tables<'projects'>;
export type NewProject = TablesInsert<'projects'>;
export type ProjectUpdate = TablesUpdate<'projects'>;

export type ProjectMember = Tables<'project_members'>;
export type NewProjectMember = TablesInsert<'project_members'>;
export type ProjectMemberUpdate = TablesUpdate<'project_members'>;

export type Zone = Tables<'zones'>;
export type NewZone = TablesInsert<'zones'>;
export type ZoneUpdate = TablesUpdate<'zones'>;

/**
 * `contract_amount` overridden from the generated `number` to `Rupiah`
 * (ARCHITECTURE.md 3.1's sanctioned Omit-and-compose, not a hand-written row).
 * The generated type says `number` because that is PostgREST's wire format
 * (ADR 0008) -- the application never treats a money value as a plain number
 * past the repository boundary (`rupiahFromColumn`/`rupiahToColumn`).
 */
export type Contract = Omit<Tables<'contracts'>, 'contract_amount'> & { contract_amount: Rupiah };
export type NewContract = Omit<TablesInsert<'contracts'>, 'contract_amount'> & { contract_amount: Rupiah };
export type ContractUpdate = Omit<TablesUpdate<'contracts'>, 'contract_amount'> & { contract_amount?: Rupiah };

/** `amount` overridden the same way as Contract.contract_amount, same reason. */
export type Milestone = Omit<Tables<'milestones'>, 'amount'> & { amount: Rupiah };
export type NewMilestone = Omit<TablesInsert<'milestones'>, 'amount'> & { amount: Rupiah };
export type MilestoneUpdate = Omit<TablesUpdate<'milestones'>, 'amount'> & { amount?: Rupiah };

export type WorkPackage = Tables<'work_packages'>;
export type NewWorkPackage = TablesInsert<'work_packages'>;
export type WorkPackageUpdate = TablesUpdate<'work_packages'>;
