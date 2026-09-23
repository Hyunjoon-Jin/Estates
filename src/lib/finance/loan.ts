import type { Params } from './types';

/** 연간 원리금 계수. ratePct 는 % 단위. */
export function annualFactor(ratePct: number, years: number): number {
  const r = ratePct / 100 / 12;
  const k = years * 12;
  if (r <= 0) return 12 / k;
  return (12 * r) / (1 - Math.pow(1 + r, -k));
}

export function monthlyPay(principal: number, ratePct: number, years: number): number {
  return (principal * annualFactor(ratePct, years)) / 12;
}

/** 수도권·규제 주택가격별 한도 */
export function capFor(price: number, p: Params): number {
  for (const c of p.caps) if (c.upTo == null || price <= c.upTo) return c.cap;
  return 0;
}
