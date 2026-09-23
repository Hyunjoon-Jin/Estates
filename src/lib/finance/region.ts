import type { Params, RegOverride } from './types';

export function isMetro(region?: string | null): boolean {
  return /^(서울|경기|인천)/.test(region ?? '');
}

/** reg_override 가 우선. 아니면 regulated 목록과 대조 ('*' 로 끝나면 접두어 일치). */
export function isReg(region: string | null | undefined, override: RegOverride, p: Params): boolean {
  if (override === 'yes') return true;
  if (override === 'no') return false;
  if (!region) return false;
  return p.regulated.some((e) => (e.endsWith('*') ? region.startsWith(e.slice(0, -1).trim()) : region === e));
}
