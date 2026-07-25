/**
 * Public API of modules/crm. The only door other modules and app/ may use to
 * reach clients, sites, client_users, or leads (ARCHITECTURE.md 1.2) --
 * nothing under data/ or domain/ is ever imported directly from outside this
 * folder.
 */

export type {
  Client,
  ClientUpdate,
  ClientUser,
  Lead,
  LeadUpdate,
  NewClient,
  NewClientUser,
  NewLead,
  NewSite,
  Site,
  SiteUpdate,
} from './types';

export type { LeadScoreFactors } from './domain/lead-scoring';
export { scoreLead } from './domain/lead-scoring';
export type { LeadStatus } from './domain/lead-transition';

export {
  convertLeadToProjectSchema,
  createClientSchema,
  createLeadSchema,
  createSiteSchema,
  updateClientSchema,
  updateLeadStatusSchema,
  updateSiteSchema,
  type ConvertLeadToProjectInput,
  type CreateClientInput,
  type CreateLeadInput,
  type CreateSiteInput,
  type UpdateClientInput,
  type UpdateLeadStatusInput,
  type UpdateSiteInput,
} from './schemas';

export { createClientAction, listClientsAction, updateClientAction, provisionClientAccountAction } from './actions/client-actions';
export { createSiteAction, getSiteAction, listSitesAction, listSitesForClientAction, updateSiteAction } from './actions/site-actions';
export {
  convertLeadToProjectAction,
  createLeadAction,
  getLeadAction,
  listLeadsAction,
  updateLeadStatusAction,
} from './actions/lead-actions';
