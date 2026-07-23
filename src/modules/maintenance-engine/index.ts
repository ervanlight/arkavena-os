/**
 * Public API of modules/maintenance-engine. The only door other modules and
 * app/ may use to reach handover_items, warranties, assets,
 * maintenance_plans, or service_tickets (ARCHITECTURE.md 1.2) -- nothing
 * under data/, domain/, or actions/ is ever imported directly from outside
 * this folder.
 */

export type {
  Asset,
  AssetUpdate,
  HandoverItem,
  MaintenancePlan,
  MaintenancePlanUpdate,
  NewAsset,
  NewHandoverItem,
  NewMaintenancePlan,
  NewServiceTicket,
  NewWarranty,
  ServiceTicket,
  ServiceTicketUpdate,
  Warranty,
  WarrantyUpdate,
} from './types';

export type { MaintenanceSchedule, MaintenanceScheduleInput } from './domain/maintenance-schedule';
export { computeNextDueDate } from './domain/maintenance-schedule';
export type { ServiceTicketStatus } from './domain/service-ticket-transition';

export {
  createAssetSchema,
  createHandoverItemSchema,
  createMaintenancePlanSchema,
  createServiceTicketSchema,
  createWarrantySchema,
  markMaintenancePlanCompletedSchema,
  updateAssetSchema,
  updateMaintenancePlanSchema,
  updateServiceTicketStatusSchema,
  updateWarrantySchema,
  type CreateAssetInput,
  type CreateHandoverItemInput,
  type CreateMaintenancePlanInput,
  type CreateServiceTicketInput,
  type CreateWarrantyInput,
  type MarkMaintenancePlanCompletedInput,
  type UpdateAssetInput,
  type UpdateMaintenancePlanInput,
  type UpdateServiceTicketStatusInput,
  type UpdateWarrantyInput,
} from './schemas';

export {
  createHandoverItemAction,
  getHandoverItemAction,
  listHandoverItemsForProjectAction,
} from './actions/handover-item-actions';

export {
  createWarrantyAction,
  getWarrantyAction,
  listWarrantiesForProjectAction,
  updateWarrantyAction,
} from './actions/warranty-actions';

export {
  createAssetAction,
  getAssetAction,
  listAssetsAction,
  listAssetsForSiteAction,
  updateAssetAction,
} from './actions/asset-actions';

export {
  createMaintenancePlanAction,
  getMaintenancePlanAction,
  getMaintenancePlanWithScheduleAction,
  listMaintenancePlansForAssetAction,
  markMaintenancePlanCompletedAction,
  updateMaintenancePlanAction,
  type MaintenancePlanWithSchedule,
} from './actions/maintenance-plan-actions';

export {
  createServiceTicketAction,
  getServiceTicketAction,
  listServiceTicketsForAssetAction,
  updateServiceTicketStatusAction,
} from './actions/service-ticket-actions';
