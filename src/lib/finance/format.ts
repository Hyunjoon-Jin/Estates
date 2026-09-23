import { n } from './num';

/** 만원 → "7억 2,000만원" */
export function won(v: unknown): string {
  let m = Math.round(n(v));
  if (m === 0) return '0원';
  const neg = m < 0;
  m = Math.abs(m);
  const eok = Math.floor(m / 10000);
  const man = m % 10000;
  const parts: string[] = [];
  if (eok) parts.push(`${eok.toLocaleString('ko-KR')}억`);
  if (man) parts.push(`${man.toLocaleString('ko-KR')}만`);
  return `${neg ? '−' : ''}${parts.join(' ')}원`;
}

/** 만원 → "7.2억" / "3,000만" (좁은 자리용) */
export function wonS(v: unknown): string {
  const m = n(v);
  if (Math.abs(m) >= 10000) return `${(m / 10000).toFixed(m % 10000 === 0 ? 0 : 1)}억`;
  return `${Math.round(m).toLocaleString('ko-KR')}만`;
}
