/**
 * Rupiah arithmetic. The only place in this codebase where money is calculated.
 *
 * CLAUDE.md law 1 and ADR 0002: money is a `bigint` of whole rupiah, never a
 * `number`, never a float. Ratios are integer basis points.
 *
 * The reason is not that rupiah amounts are large. It is that the two ways
 * floating point corrupts money are both silent:
 *
 *   - Above 2^53 an integer stops being representable exactly, and the result
 *     is a plausible-looking number that is wrong in its last digits. No error
 *     is raised. Intermediate results in a coverage calculation reach that
 *     range long before any single contract does.
 *   - Decimal fractions do not round-trip: 0.1 + 0.2 !== 0.3. Applied twice in
 *     two places, the same invoice totals two different amounts, and it
 *     surfaces as a client dispute rather than a stack trace.
 *
 * `src/core/money/rupiah.test.ts` demonstrates both against this module rather
 * than merely asserting them.
 */

declare const RUPIAH_BRAND: unique symbol;

/**
 * A whole-rupiah amount.
 *
 * The brand is what stops an unvetted `bigint` -- a raw database value, a
 * parsed form field -- drifting into a calculation without passing through
 * `toRupiah`. Structurally it is a bigint; to the type system it is not
 * interchangeable with one.
 */
export type Rupiah = bigint & { readonly [RUPIAH_BRAND]: 'Rupiah' };

/**
 * Basis points: an integer where 10000 means 1.0000 (100%).
 *
 * Percentages invite decimals, and decimals invite floats. Basis points keep
 * every ratio in this system an integer, which is why the Cash Gate thresholds
 * can be compared with `>=` and mean exactly what they say.
 */
export type BasisPoints = number;

export const BP_SCALE = 10_000;

/**
 * Cash Gate thresholds (ARCHITECTURE.md 4.2).
 *
 * Named, exported, and tested at their exact boundaries. These same numbers are
 * mirrored into `fn_cash_gate_status()` in Fase 2 so the database enforces the
 * identical rule -- the two-layer enforcement of ARCHITECTURE.md 0.2. If one is
 * ever changed, the other must change in the same commit.
 */
export const CASH_GATE_GREEN_BP: BasisPoints = 11_000; // >= 1.1000 coverage
export const CASH_GATE_YELLOW_FLOOR_BP: BasisPoints = 10_000; // >= 1.0000 coverage

export const ZERO_RP = 0n as Rupiah;

/** True when the value is a whole-rupiah bigint. Rejects floats and non-integers. */
export function isRupiah(value: unknown): value is Rupiah {
  return typeof value === 'bigint';
}

/**
 * The one entry point into Rupiah.
 *
 * Accepts a bigint, a digit string, or a safe integer `number`. It rejects a
 * non-integer `number` rather than truncating it: a caller passing 1500.75 has
 * a bug, and silently making it 1500 hides the bug and loses 75 rupiah.
 *
 * It also rejects a `number` above Number.MAX_SAFE_INTEGER, because by then the
 * value has already lost precision -- converting it would launder a wrong
 * number into the type system as if it were exact.
 */
export function toRupiah(value: bigint | number | string): Rupiah {
  if (typeof value === 'bigint') {
    return value as Rupiah;
  }

  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new TypeError(
        `Rupiah must be a whole number, got ${value}. Round explicitly at the point where the fraction appears, and record why.`,
      );
    }
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(
        `${value} is beyond Number.MAX_SAFE_INTEGER and has already lost precision. Pass a bigint or a string instead.`,
      );
    }
    return BigInt(value) as Rupiah;
  }

  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new TypeError(`Cannot read "${value}" as whole rupiah. Expected digits only, no separators or decimals.`);
  }
  return BigInt(trimmed) as Rupiah;
}

export function addRp(...amounts: readonly Rupiah[]): Rupiah {
  let total = 0n;
  for (const amount of amounts) total += amount;
  return total as Rupiah;
}

export function subRp(minuend: Rupiah, ...subtrahends: readonly Rupiah[]): Rupiah {
  let total = minuend as bigint;
  for (const amount of subtrahends) total -= amount;
  return total as Rupiah;
}

/**
 * Multiply by a whole factor -- a quantity, not a rate.
 *
 * There is no `mulRp(amount, 1.1)`: that is a rate, and rates go through
 * `applyBp` so the rounding is explicit.
 */
export function mulRp(amount: Rupiah, factor: bigint | number): Rupiah {
  const f = typeof factor === 'number' ? BigInt(requireInteger(factor, 'factor')) : factor;
  return ((amount as bigint) * f) as Rupiah;
}

/** Three-decimal precision -- matches `estimate_items.quantity numeric(14,3)` exactly (ADR 0018 SS4). */
export const QUANTITY_SCALE = 1_000;

/**
 * Multiply by a fractional real-world quantity (m2, m3, ...) at
 * `QUANTITY_SCALE` precision, rounding mode stated at the call site --
 * same reasoning as `applyBp`. Distinct from `mulRp` (a whole factor) and
 * `applyBp` (a rate/percentage): a quantity is neither, but is still
 * routinely fractional, which is exactly what a plain `mulRp` cannot
 * accept. `quantity` arrives as a plain `number`, not `Rupiah` -- it is a
 * count of units, never a money value itself.
 */
export function mulRpQuantity(amount: Rupiah, quantity: number, rounding: 'floor' | 'ceil' | 'half-up'): Rupiah {
  if (!Number.isFinite(quantity)) {
    throw new TypeError(`quantity must be a finite number, got ${quantity}`);
  }

  const scaledQuantity = BigInt(Math.round(quantity * QUANTITY_SCALE));
  const product = (amount as bigint) * scaledQuantity;
  const divisor = BigInt(QUANTITY_SCALE);
  const quotient = product / divisor; // bigint division truncates toward zero
  const remainder = product % divisor;

  if (remainder === 0n) return quotient as Rupiah;

  const negative = product < 0n;

  switch (rounding) {
    case 'floor':
      return (negative ? quotient - 1n : quotient) as Rupiah;
    case 'ceil':
      return (negative ? quotient : quotient + 1n) as Rupiah;
    case 'half-up': {
      const twiceRemainder = (remainder < 0n ? -remainder : remainder) * 2n;
      if (twiceRemainder < divisor) return quotient as Rupiah;
      return (negative ? quotient - 1n : quotient + 1n) as Rupiah;
    }
  }
}

export function negateRp(amount: Rupiah): Rupiah {
  return -(amount as bigint) as Rupiah;
}

export function absRp(amount: Rupiah): Rupiah {
  const v = amount as bigint;
  return (v < 0n ? -v : v) as Rupiah;
}

export function isZeroRp(amount: Rupiah): boolean {
  return (amount as bigint) === 0n;
}

export function isNegativeRp(amount: Rupiah): boolean {
  return (amount as bigint) < 0n;
}

export function compareRp(a: Rupiah, b: Rupiah): -1 | 0 | 1 {
  const x = a as bigint;
  const y = b as bigint;
  return x < y ? -1 : x > y ? 1 : 0;
}

export function minRp(...amounts: readonly Rupiah[]): Rupiah {
  if (amounts.length === 0) throw new TypeError('minRp needs at least one amount');
  return amounts.reduce((lowest, current) => (current < lowest ? current : lowest));
}

export function maxRp(...amounts: readonly Rupiah[]): Rupiah {
  if (amounts.length === 0) throw new TypeError('maxRp needs at least one amount');
  return amounts.reduce((highest, current) => (current > highest ? current : highest));
}

export function sumRp(amounts: Iterable<Rupiah>): Rupiah {
  let total = 0n;
  for (const amount of amounts) total += amount;
  return total as Rupiah;
}

/**
 * The ratio of two amounts, in basis points.
 *
 * This is the shape of the Funding Coverage Ratio. Two details are deliberate.
 *
 * The multiplication happens before the division, entirely in bigint, so no
 * intermediate value is ever a float -- which is what would quietly break at
 * scale if this were written the obvious way.
 *
 * Division by zero returns `null` rather than throwing or returning 0. A
 * project with nothing needed in the next fourteen days has *no* coverage
 * ratio; that is different from a ratio of zero, which would read as "no
 * funding" and turn the Cash Gate red for a project that is perfectly fine.
 * ARCHITECTURE.md 4.5 requires that case to be tested explicitly, and `null`
 * makes the caller decide what it means.
 */
export function ratioBp(numerator: Rupiah, denominator: Rupiah): BasisPoints | null {
  const d = denominator as bigint;
  if (d === 0n) return null;

  const scaled = ((numerator as bigint) * BigInt(BP_SCALE)) / d;
  return Number(scaled);
}

/**
 * Apply a basis-point rate, with the rounding stated at the call site.
 *
 * There is no default rounding mode. Whether a fraction of a rupiah favours the
 * company or the client is a business decision, and a default would make it
 * invisibly and inconsistently.
 */
export function applyBp(amount: Rupiah, bp: BasisPoints, rounding: 'floor' | 'ceil' | 'half-up'): Rupiah {
  requireInteger(bp, 'basis points');

  const product = (amount as bigint) * BigInt(bp);
  const divisor = BigInt(BP_SCALE);
  const quotient = product / divisor; // bigint division truncates toward zero
  const remainder = product % divisor;

  if (remainder === 0n) return quotient as Rupiah;

  const negative = product < 0n;

  switch (rounding) {
    case 'floor':
      return (negative ? quotient - 1n : quotient) as Rupiah;
    case 'ceil':
      return (negative ? quotient : quotient + 1n) as Rupiah;
    case 'half-up': {
      const twiceRemainder = (remainder < 0n ? -remainder : remainder) * 2n;
      if (twiceRemainder < divisor) return quotient as Rupiah;
      return (negative ? quotient - 1n : quotient + 1n) as Rupiah;
    }
  }
}

/**
 * Split an amount into `parts` shares that add back up to the original exactly.
 *
 * The naive version -- divide, then multiply back -- loses rupiah to truncation,
 * so a total stops matching the sum of its lines. Here the remainder is
 * distributed one rupiah at a time across the leading shares, which makes the
 * shares differ by at most one rupiah and the sum exact. The test asserts that
 * reconstruction property rather than specific share values.
 */
export function splitRp(amount: Rupiah, parts: number): Rupiah[] {
  requireInteger(parts, 'parts');
  if (parts <= 0) throw new TypeError(`Cannot split into ${parts} parts`);

  const total = amount as bigint;
  const count = BigInt(parts);
  const base = total / count;
  const remainder = total % count;
  const step = remainder < 0n ? -1n : 1n;
  const spread = remainder < 0n ? -remainder : remainder;

  return Array.from({ length: parts }, (_unused, index) =>
    (base + (BigInt(index) < spread ? step : 0n)) as Rupiah,
  );
}

/**
 * Format for display: "Rp 1.250.000".
 *
 * Indonesian convention, per owner decision D10. No decimals, because the
 * currency has none in practice and showing ",00" would imply a precision the
 * system deliberately does not carry.
 */
export function formatRp(amount: Rupiah, options?: { withSymbol?: boolean }): string {
  const withSymbol = options?.withSymbol ?? true;
  const value = amount as bigint;
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString();

  let grouped = '';
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) grouped += '.';
    grouped += digits[i];
  }

  const sign = negative ? '-' : '';
  return withSymbol ? `${sign}Rp ${grouped}` : `${sign}${grouped}`;
}

/** Basis points as Indonesian percent text: 11000 -> "110,00%". */
export function formatBp(bp: BasisPoints): string {
  const whole = Math.trunc(bp / 100);
  const fraction = Math.abs(bp % 100).toString().padStart(2, '0');
  return `${whole},${fraction}%`;
}

/**
 * Serialise for the wire. `bigint` has no JSON representation, so every
 * boundary converts explicitly -- friction on purpose, since each conversion is
 * a place someone had to think about precision.
 */
export function serialiseRp(amount: Rupiah): string {
  return (amount as bigint).toString();
}

export function deserialiseRp(value: string): Rupiah {
  return toRupiah(value);
}

/**
 * Read a money column back from Supabase.
 *
 * PostgREST serialises Postgres `bigint` as a bare JSON number, which loses
 * precision above 2^53 -- silently, before this function or `toRupiah` ever
 * sees the value (verified directly against the real database; see ADR 0008).
 * This is safe specifically *because* every money column carries a `CHECK
 * (... <= 999_999_999_999_999)` constraint keeping it under that boundary --
 * not because JS numbers are trusted for money in general. A money column
 * without that constraint must not use this function.
 */
export function rupiahFromColumn(value: number): Rupiah {
  return toRupiah(value);
}

/**
 * Write a money column back to Supabase.
 *
 * The generated Insert/Update types spell every money column as `number`
 * because that is what PostgREST's request body expects. Safe for the same
 * reason `rupiahFromColumn` is: the value already satisfies the column's
 * safe-integer CHECK constraint (ADR 0008) before it gets here, whether that
 * value came from this application or was just read back from the database.
 */
export function rupiahToColumn(value: Rupiah): number {
  return Number(value);
}

function requireInteger(value: number, label: string): number {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${label} must be a whole number, got ${value}`);
  }
  return value;
}
