/**
 * Public API of modules/projects. The only door other modules and app/ may
 * use to reach projects, project_members, zones, contracts, milestones, or
 * work_packages (ARCHITECTURE.md 1.2) -- one module owns all six tables
 * (ARCHITECTURE.md 1.1).
 */

export type {
  Contract,
  ContractUpdate,
  Milestone,
  MilestoneUpdate,
  NewContract,
  NewMilestone,
  NewProject,
  NewProjectMember,
  NewWorkPackage,
  NewZone,
  Project,
  ProjectMember,
  ProjectMemberUpdate,
  ProjectUpdate,
  WorkPackage,
  WorkPackageUpdate,
  Zone,
  ZoneUpdate,
} from './types';

export {
  addProjectMemberSchema,
  createContractSchema,
  createMilestoneSchema,
  createProjectSchema,
  createWorkPackageSchema,
  createZoneSchema,
  removeProjectMemberSchema,
  updateContractSchema,
  updateMilestoneSchema,
  updateProjectSchema,
  updateWorkPackageSchema,
  updateZoneSchema,
  type AddProjectMemberInput,
  type CreateContractInput,
  type CreateMilestoneInput,
  type CreateProjectInput,
  type CreateWorkPackageInput,
  type CreateZoneInput,
  type RemoveProjectMemberInput,
  type UpdateContractInput,
  type UpdateMilestoneInput,
  type UpdateProjectInput,
  type UpdateWorkPackageInput,
  type UpdateZoneInput,
} from './schemas';

export { createProjectAction, getProjectAction, listProjectsAction, updateProjectAction } from './actions/project-actions';
export { getWorkPackage } from './data/work-packages-repository';
export { getMyProjectRole } from './data/project-members-repository';
export {
  addProjectMemberAction,
  listProjectMembersAction,
  removeProjectMemberAction,
} from './actions/project-member-actions';
export { createZoneAction, listZonesForProjectAction, updateZoneAction } from './actions/zone-actions';
export {
  createContractAction,
  listContractsForProjectAction,
  updateContractAction,
} from './actions/contract-actions';
export {
  createMilestoneAction,
  listMilestonesForContractAction,
  updateMilestoneAction,
} from './actions/milestone-actions';
export {
  createWorkPackageAction,
  listWorkPackagesForProjectAction,
  updateWorkPackageAction,
} from './actions/work-package-actions';

export { ZoneMap } from './components/zone-map';
