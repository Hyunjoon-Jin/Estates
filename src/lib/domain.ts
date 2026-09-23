import { calcBuy, calcRent, finBase, n, type FinInput, type Params } from './finance';
import { RATE_KEYS, type Complex, type Member, type PriceRecord, type Role, type Visit } from './types';

export function roleLabel(r?: Role | null) {
  return r === 'groom' ? '신랑' : r === 'bride' ? '신부' : '';
}

/** 호칭 → 프로필 이름 → 신랑/신부 */
export function memberName(m?: Member | null): string {
  if (!m) return '누군가';
  return m.nick || m.display_name || roleLabel(m.role);
}

export function isJeonse(t: string) {
  return t.startsWith('전세');
}

export function pricesOf(complexId: string, prices: PriceRecord[]) {
  return prices.filter((p) => p.complex_id === complexId);
}

/** 최신 시세. kind 가 있으면 매매/전세 구분만 */
export function latestPrice(complexId: string, prices: PriceRecord[], kind?: 'buy' | 'rent') {
  return pricesOf(complexId, prices)
    .filter((p) => (kind ? (kind === 'rent') === isJeonse(p.type) : true))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];
}

/** 후보 카드 자금 배지와 자금 탭이 같은 함수를 쓰도록 한 곳에 둔다 */
export function dealVerdict(price: number | null | undefined, dealType: '매매' | '전세', cx: Complex | undefined, f: FinInput, p: Params) {
  if (!n(price) || !(finBase(f).cash > 0)) return null;
  const r = dealType === '전세'
    ? calcRent(price, cx?.region, f, p, cx?.reg_override)
    : calcBuy(price, cx?.region, f, p, cx?.reg_override);
  return r;
}

export function avgScore(v: Visit): number {
  const xs = RATE_KEYS.map(([k]) => n(v.ratings?.[k])).filter((x) => x > 0);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
