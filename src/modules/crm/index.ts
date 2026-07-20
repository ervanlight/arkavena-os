/**
 * Public API of modules/crm. The only door other modules and app/ may use to
 * reach clients, sites, or client_users (ARCHITECTURE.md 1.2) -- nothing under
 * data/ or domain/ is ever imported directly from outside this folder.
 */

export type { Client, ClientUpdate, ClientUser, NewClient, NewClientUser, NewSite, Site, SiteUpdate } from './types';

export {
  createClientSchema,
  createSiteSchema,
  updateClientSchema,
  updateSiteSchema,
  type CreateClientInput,
  type CreateSiteInput,
  type UpdateClientInput,
  type UpdateSiteInput,
} from './schemas';

export { createClientAction, listClientsAction, updateClientAction } from './actions/client-actions';
export { createSiteAction, listSitesAction, listSitesForClientAction, updateSiteAction } from './actions/site-actions';
