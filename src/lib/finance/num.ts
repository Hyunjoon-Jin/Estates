/** 입력 문자열("85,000" 등)을 숫자로. 숫자가 아니면 0. */
export function n(v: unknown): number {
  const x = Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(x) ? x : 0;
}
