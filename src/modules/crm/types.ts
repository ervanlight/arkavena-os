import type { Rupiah } from '@/core/money/rupiah';
import type { Tables, TablesInsert, TablesUpdate } from '@/core/db/database.types';

/**
 * Row types always derive from the generated schema (ARCHITECTURE.md 3.1) --
 * never redeclared by hand. A column rename in a migration becomes a compile
 * error everywhere one of these is used, not a runtime mismatch discovered by
 * a user.
 */

export type Client = Tables<'clients'>;
export type NewClient = TablesInsert<'clients'>;
export type ClientUpdate = TablesUpdate<'clients'>;

export type Site = Tables<'sites'>;
export type NewSite = TablesInsert<'sites'>;
export type SiteUpdate = TablesUpdate<'sites'>;

export type ClientUser = Tables<'client_users'>;
export type NewClientUser = TablesInsert<'client_users'>;

/** `estimated_value` overridden from the generated `number | null` to `Rupiah | null` (ARCHITECTURE.md 3.1's Omit-and-compose), same pattern as every other money column in this codebase. */
export type Lead = Omit<Tables<'leads'>, 'estimated_value'> & { estimated_value: Rupiah | null };
export type NewLead = Omit<TablesInsert<'leads'>, 'estimated_value'> & { estimated_value?: Rupiah | null };
export type LeadUpdate = Omit<TablesUpdate<'leads'>, 'estimated_value'> & { estimated_value?: Rupiah | null };
