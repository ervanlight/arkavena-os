import type { z } from 'zod';
import { asAppError, toActionResult, type ActionResult } from '@/core/errors/handle';
import { ValidationError } from '@/core/errors/app-error';
import { requirePermission, type ActionContext } from '@/core/permissions/guard';
import type { ActionFor, Resource } from '@/core/permissions/matrix';
import { logger } from '@/core/logging/logger';

/**
 * The one wrapper every server action goes through (CLAUDE.md 4).
 *
 * It runs the same five steps in the same order, every time:
 *
 *   1. Validate input with Zod, at the boundary and only here.
 *   2. Resolve the session and organisation context.
 *   3. Check the permission matrix.
 *   4. Run the handler.
 *   5. Map anything thrown onto the single ActionResult shape.
 *
 * The point is not to save typing. It is that ad-hoc try/catch per feature
 * produces inconsistent error shapes and, worse, inconsistent *leakage* -- one
 * action returning a raw Postgres message while another returns a clean one.
 * ARCHITECTURE.md 5.1 rule 2 makes this the only path, so the leak has one
 * place to be prevented.
 */

export type ContextLoader = () => Promise<ActionContext | null>;

type SafeActionConfig<TResource extends Resource> = {
  /** Zod schema for the action's input. Validation happens here and nowhere else. */
  schema: z.ZodType<unknown>;
  /** The permission required. Omitted only for actions available to any signed-in user. */
  permission?: { resource: TResource; action: ActionFor<TResource> };
  /** How to obtain the session. Injected so the wrapper is testable without a request. */
  loadContext: ContextLoader;
  /** For logs and audit correlation, e.g. 'billing.issueInvoice'. */
  name: string;
};

/**
 * Build a server action.
 *
 * The returned function never throws. It resolves to an ActionResult, which is
 * what lets the UI have exactly one failure handler.
 */
export function safeAction<TInput, TOutput, TResource extends Resource>(
  config: SafeActionConfig<TResource> & { schema: z.ZodType<TInput> },
  handler: (input: TInput, context: ActionContext) => Promise<TOutput>,
): (rawInput: unknown) => Promise<ActionResult<TOutput>> {
  return async (rawInput: unknown): Promise<ActionResult<TOutput>> => {
    const startedAt = Date.now();
    let context: ActionContext | null = null;

    try {
      const parsed = config.schema.safeParse(rawInput);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        throw new ValidationError(`Invalid input for ${config.name}: ${parsed.error.message}`, {
          ...(first?.path[0] !== undefined ? { field: String(first.path[0]) } : {}),
          meta: { action: config.name, issues: parsed.error.issues },
        });
      }

      context = await config.loadContext();

      if (config.permission !== undefined) {
        requirePermission(context, config.permission.resource, config.permission.action);
      } else if (context === null) {
        // Even an action with no matrix entry requires a signed-in user; there
        // are no anonymous server actions in this system.
        requirePermission(context, 'notification', 'view');
      }

      const data = await handler(parsed.data, context as ActionContext);

      logger.info('action.ok', {
        action: config.name,
        durationMs: Date.now() - startedAt,
        userId: context?.userId,
        organizationId: context?.organizationId,
        requestId: context?.requestId,
      });

      return { ok: true, data };
    } catch (error) {
      const appError = asAppError(error, { action: config.name });

      // The full technical detail goes here. What comes back to the caller is
      // the sanitised version from toActionResult -- ARCHITECTURE.md 5.1 rule 4.
      logger.error('action.failed', {
        action: config.name,
        code: appError.code,
        message: appError.message,
        durationMs: Date.now() - startedAt,
        userId: context?.userId,
        organizationId: context?.organizationId,
        requestId: context?.requestId,
        meta: appError.meta,
      });

      return toActionResult(appError);
    }
  };
}
