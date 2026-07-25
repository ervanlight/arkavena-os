/**
 * Public API of modules/estimating. The only door other modules and app/
 * may use to reach cost_library, estimates, estimate_items, or proposals
 * (ARCHITECTURE.md 1.2) -- nothing under data/, domain/, or actions/ is
 * ever imported directly from outside this folder.
 */

export type {
  CostLibraryItem,
  CostLibraryItemUpdate,
  Estimate,
  EstimateItem,
  EstimateItemUpdate,
  EstimateUpdate,
  NewCostLibraryItem,
  NewEstimate,
  NewEstimateItem,
  NewProposal,
  Proposal,
  ProposalUpdate,
} from './types';

export type { EstimateLine, MarginResult } from './domain/margin';
export { computeMargin, isBelowMarginFloor } from './domain/margin';

export {
  createCostLibraryItemSchema,
  createEstimateItemSchema,
  createEstimateSchema,
  createProposalSchema,
  decideProposalSchema,
  sendProposalSchema,
  setBaselineEstimateSchema,
  updateCostLibraryItemSchema,
  updateEstimateItemSchema,
  updateEstimateSchema,
  type CreateCostLibraryItemInput,
  type CreateEstimateInput,
  type CreateEstimateItemInput,
  type CreateProposalInput,
  type DecideProposalInput,
  type SendProposalInput,
  type SetBaselineEstimateInput,
  type UpdateCostLibraryItemInput,
  type UpdateEstimateInput,
  type UpdateEstimateItemInput,
} from './schemas';

export {
  createCostLibraryItemAction,
  getCostLibraryItemAction,
  listCostLibraryItemsAction,
  updateCostLibraryItemAction,
} from './actions/cost-library-actions';

export {
  createEstimateAction,
  getEstimateAction,
  getEstimateWithMarginAction,
  listEstimatesForProjectAction,
  setBaselineEstimateAction,
  updateEstimateAction,
  type EstimateWithMargin,
} from './actions/estimate-actions';

export {
  createEstimateItemAction,
  getEstimateItemAction,
  listEstimateItemsForEstimateAction,
  updateEstimateItemAction,
} from './actions/estimate-item-actions';

export {
  createProposalAction,
  decideProposalAction,
  getProposalAction,
  listProposalsForProjectAction,
  sendProposalAction,
} from './actions/proposal-actions';
