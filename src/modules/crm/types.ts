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
