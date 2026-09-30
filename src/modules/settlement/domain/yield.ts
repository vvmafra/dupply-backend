/** Day-count convention for the monthly rate: 1 month = 30 days (Brazilian "taxa ao mês"). */
export const DAYS_PER_MONTH = 30;

/**
 * Simple (non-compounding) interest in cents, pro-rata by days over a 30-day month:
 *   interest = principal × (yieldRateMonthly / 30) × days
 * Rounded to the nearest cent. Never negative.
 */
export function computeSimpleInterestCents(
  principalCents: number,
  yieldRateMonthly: number,
  days: number,
): number {
  if (principalCents <= 0 || yieldRateMonthly <= 0 || days <= 0) return 0;
  return Math.round(principalCents * (yieldRateMonthly / DAYS_PER_MONTH) * days);
}

/** Whole days between two instants, minimum 1 (a same-day settlement still accrues one day). */
export function accrualDays(fundedAt: Date, paymentDate: Date): number {
  const diffDays = Math.round((paymentDate.getTime() - fundedAt.getTime()) / 86_400_000);
  return Math.max(1, diffDays);
}
