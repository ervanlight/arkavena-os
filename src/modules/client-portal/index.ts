/**
 * Public API of modules/client-portal. The only door other modules and
 * app/ may use to reach client_decisions or the vw_client_* views
 * (ARCHITECTURE.md 1.2, ADR 0016). Owns client_decisions; reads everything
 * else cross-module through the vw_client_* views rather than another
 * module's own tables.
 */

export type {
  ClientDecision,
  ClientProgressPhoto,
  ClientProjectOverview,
  ClientTimelineEvent,
  ClientZoneProgress,
} from './types';

export type { DecisionClockTier } from './domain/decision-clock';

export {
  getClientProjectOverviewAction,
  listClientDecisionsAction,
  listClientProgressPhotosAction,
  listClientTimelineEventsAction,
  listClientZoneProgressAction,
  listPendingClientDecisionsAction,
} from './actions/client-portal-actions';
