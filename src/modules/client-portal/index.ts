/**
 * Public API of modules/client-portal. The only door other modules and
 * app/ may use to reach client_decisions, client_status_updates, or the
 * vw_client_* views (ARCHITECTURE.md 1.2, ADR 0016, ADR 0026 §2). Owns
 * client_decisions and client_status_updates; reads everything else
 * cross-module through the vw_client_* views rather than another module's
 * own tables.
 */

export type {
  ClientDecision,
  ClientProgressPhoto,
  ClientProjectOverview,
  ClientStatusUpdate,
  ClientTimelineEvent,
  ClientZoneProgress,
} from './types';

export type { DecisionClockTier } from './domain/decision-clock';

export { publishClientStatusSchema, type PublishClientStatusInput } from './schemas';

export {
  getClientProjectOverviewAction,
  listClientDecisionsAction,
  listClientProgressPhotosAction,
  listClientTimelineEventsAction,
  listClientZoneProgressAction,
  listPendingClientDecisionsAction,
} from './actions/client-portal-actions';

export { publishClientStatusAction, listClientStatusUpdatesForProjectAction } from './actions/client-status-actions';
