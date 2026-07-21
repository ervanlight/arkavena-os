/**
 * Public API of modules/scope-variation. The only door other modules and
 * app/ may use to reach change_orders (ARCHITECTURE.md 1.2) -- this module
 * owns that table outright (ARCHITECTURE.md 1.1). work_packages.change_order_id
 * stays owned by modules/projects (it is a column on their table), guarded
 * by trg_work_packages_guard_change_order_funded regardless of which module
 * writes it.
 */

export type { ChangeOrder, ChangeOrderUpdate, NewChangeOrder } from './types';
export type { ChangeOrderEvent, ChangeOrderStatus } from './domain/types';

export {
  changeOrderReasonSchema,
  createChangeOrderSchema,
  setChangeOrderImpactSchema,
  type ChangeOrderReasonInput,
  type CreateChangeOrderInput,
  type SetChangeOrderImpactInput,
} from './schemas';

export {
  completeChangeOrderAction,
  createChangeOrderAction,
  getChangeOrderAction,
  listChangeOrdersForProjectAction,
  markChangeOrderFundedAction,
  rejectChangeOrderAction,
  sendChangeOrderToClientAction,
  setChangeOrderImpactAction,
  submitChangeOrderForReviewAction,
} from './actions/change-order-actions';

export { clientApproveChangeOrderAction, clientRejectChangeOrderAction } from './actions/client-decision-actions';
