/**
 * The one shared rule that decides whether a project's client-facing layer
 * activates -- Client Project Status / Client Timeline (ADR 0026 SS2/SS4) and
 * Evidence-gating (ADR 0029 Decision 2) both call this instead of each
 * independently re-deriving "does this project have a signed contract yet."
 * Named explicitly (ADR 0029's design-review amendment) so the coupling is
 * visible in code, not two places quietly agreeing by convention.
 *
 * A project exists as early as a lead being merely `qualified`
 * (`convertLeadToProjectAction`, ARCHITECTURE_REVIEW.md/WORKFLOW_REVIEW.md's
 * own finding) -- well before any contract exists. `project_status` carries
 * no useful signal for this decision (ADR 0028 Decision 1: it intentionally
 * keeps its five existing values, unchanged); only whether an active
 * contract exists does.
 *
 * Takes primitive/narrow shapes rather than the module's `Project`/`Contract`
 * row types -- domain/ may only import core/money, core/errors, lib
 * (CLAUDE.md 1), never the module's own types.ts (which ultimately derives
 * from generated DB types). Callers (outside domain/, where importing the
 * real row types is allowed) narrow before calling.
 */
export type ContractStatusRef = { projectId: string; status: string };

export function isProjectClientFacing(projectId: string, contracts: readonly ContractStatusRef[]): boolean {
  return contracts.some((contract) => contract.projectId === projectId && contract.status === 'active');
}
