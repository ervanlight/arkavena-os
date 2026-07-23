/**
 * Lead scoring (ARCHITECTURE.md 8, ADR 0018 SS1). A transparent, additive
 * point sum -- not a black-box model -- so a non-technical owner can see
 * exactly why a lead scored what it did. A first-draft set of weights, easy
 * to adjust in this one place, same "computed, not stored" treatment
 * Decision Clock (Fase 6) and the aging tiers (Fase 7) already got.
 */

export type LeadScoreFactors = {
  readonly budgetKnown: boolean;
  /** Computed by the caller from desired_start_date vs "now" -- domain/ never reads the ambient clock (ARCHITECTURE.md 4.1). */
  readonly desiredStartWithin90Days: boolean;
  readonly referredByExistingClient: boolean;
  readonly estimatedValueAtLeastThreshold: boolean;
};

const POINTS = {
  budgetKnown: 25,
  desiredStartWithin90Days: 25,
  referredByExistingClient: 30,
  estimatedValueAtLeastThreshold: 20,
} as const;

export function scoreLead(factors: LeadScoreFactors): number {
  let score = 0;
  if (factors.budgetKnown) score += POINTS.budgetKnown;
  if (factors.desiredStartWithin90Days) score += POINTS.desiredStartWithin90Days;
  if (factors.referredByExistingClient) score += POINTS.referredByExistingClient;
  if (factors.estimatedValueAtLeastThreshold) score += POINTS.estimatedValueAtLeastThreshold;
  return score;
}
