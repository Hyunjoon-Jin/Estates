/** 취득세 + 지방교육세 + 농특세. 생애최초 감면은 12억 이하에서 최대 200만원. */
export function acqTax(p: number, over85: boolean, relief: boolean): { total: number; rate: number } {
  const eok = p / 10000;
  let rate: number;
  if (p <= 60000) rate = 1;
  else if (p <= 90000) rate = Math.round(((eok * 2) / 3 - 3) * 100) / 100;
  else rate = 3;
  const tax = (p * rate) / 100;
  const edu = tax * 0.1;
  const farm = over85 ? p * 0.002 : 0;
  let total = tax + edu + farm;
  if (relief && p <= 120000) total = Math.max(0, total - 200);
  return { total, rate };
}

/** 매매 중개보수 상한 */
export function brokerBuy(p: number): number {
  if (p < 5000) return Math.min(p * 0.006, 25);
  if (p < 20000) return Math.min(p * 0.005, 80);
  if (p < 90000) return p * 0.004;
  if (p < 120000) return p * 0.005;
  if (p < 150000) return p * 0.006;
  return p * 0.007;
}

/** 전세 중개보수 상한 */
export function brokerRent(p: number): number {
  if (p < 5000) return Math.min(p * 0.005, 20);
  if (p < 10000) return Math.min(p * 0.004, 30);
  if (p < 60000) return p * 0.003;
  if (p < 120000) return p * 0.004;
  if (p < 150000) return p * 0.005;
  return p * 0.006;
}
