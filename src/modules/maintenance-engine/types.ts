import type { Tables, TablesInsert, TablesUpdate } from '@/core/db/database.types';

/**
 * Row types always derive from the generated schema (ARCHITECTURE.md 3.1).
 * No money column anywhere in this module (ADR 0019) -- nothing here needs
 * the Rupiah re-brand every estimating/procurement/cash-gate type does.
 */

export type HandoverItem = Tables<'handover_items'>;
export type NewHandoverItem = TablesInsert<'handover_items'>;
export type HandoverItemUpdate = TablesUpdate<'handover_items'>;

export type Warranty = Tables<'warranties'>;
export type NewWarranty = TablesInsert<'warranties'>;
export type WarrantyUpdate = TablesUpdate<'warranties'>;

export type Asset = Tables<'assets'>;
export type NewAsset = TablesInsert<'assets'>;
export type AssetUpdate = TablesUpdate<'assets'>;

export type MaintenancePlan = Tables<'maintenance_plans'>;
export type NewMaintenancePlan = TablesInsert<'maintenance_plans'>;
export type MaintenancePlanUpdate = TablesUpdate<'maintenance_plans'>;

export type ServiceTicket = Tables<'service_tickets'>;
export type NewServiceTicket = TablesInsert<'service_tickets'>;
export type ServiceTicketUpdate = TablesUpdate<'service_tickets'>;
