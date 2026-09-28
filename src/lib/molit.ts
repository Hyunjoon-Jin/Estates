import { sb } from './supabase';

export type MolitKind = 'trade' | 'rent';

export interface MolitDeal {
  kind: MolitKind;
  name: string;
  dong: string;
  jibun: string;
  sggCd: string;
  area: number;
  floor: string;
  date: string;
  price: number;
  monthlyRent: number;
  buildYear: string;
  cancelled: boolean;
  key: string;
}

export interface MolitName {
  name: string;
  sggCd: string;
  dong: string;
  count: number;
  latestDate: string;
  latestPrice: number;
  areas: number[];
}

interface Req {
  lawdCds: string[];
  months: number;
  kind: MolitKind;
  name?: string;
  limit?: number;
}

async function call<T>(body: Req & { mode?: 'deals' | 'names' }): Promise<T & { errors: string[] }> {
  const { data } = await sb().auth.getSession();
  let res: Response;
  try {
    res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/molit-trades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.session?.access_token ?? ''}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('네트워크에 연결하지 못했어요. 연결을 확인하고 다시 시도해주세요.');
  }
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(out.message ?? (res.status === 403 ? '가정 구성원만 조회할 수 있어요.' : '실거래가를 불러오지 못했어요. 잠시 뒤 다시 시도해주세요.'));
    (err as Error & { code?: string }).code = out.error;
    throw err;
  }
  return out;
}

export const fetchDeals = (r: Req) => call<{ deals: MolitDeal[]; total: number }>({ ...r, mode: 'deals' });
export const searchNames = (r: Req) => call<{ names: MolitName[] }>({ ...r, mode: 'names' });

/** "84㎡", "84.97", "34평"(대략) → 전용면적 숫자. 모르면 null */
export function areaOf(text?: string | null): number | null {
  if (!text) return null;
  const m = text.match(/(\d+(?:\.\d+)?)\s*(㎡|m2|평)?/i);
  if (!m) return null;
  const v = Number(m[1]);
  const sq = m[2] === '평' ? v * 3.3058 * 0.76 : v; // 공급평형 → 전용 대략
  return sq >= 15 && sq <= 300 ? sq : null;
}

/** 관심 평형과 같은 면적대인지 (±3㎡) */
export function sameArea(area: number, target: number | null): boolean {
  return target == null || Math.abs(area - target) <= 3;
}

export interface ComplexGroup {
  name: string;
  sggCd: string;
  dong: string;
  deals: MolitDeal[];
  latest: MolitDeal;
  min: number;
  max: number;
  areas: number[];
}

/** 거래를 단지별로 묶는다 (해제 거래는 가격 요약에서 뺀다) */
export function groupByComplex(deals: MolitDeal[]): ComplexGroup[] {
  const map = new Map<string, MolitDeal[]>();
  for (const d of deals) {
    const k = `${d.sggCd}|${d.name}`;
    const arr = map.get(k);
    if (arr) arr.push(d); else map.set(k, [d]);
  }
  const out: ComplexGroup[] = [];
  for (const arr of map.values()) {
    arr.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const valid = arr.filter((d) => !d.cancelled);
    const base = valid.length ? valid : arr;
    const prices = base.map((d) => d.price);
    out.push({
      name: arr[0].name,
      sggCd: arr[0].sggCd,
      dong: arr[0].dong,
      deals: arr,
      latest: base[0],
      min: Math.min(...prices),
      max: Math.max(...prices),
      areas: [...new Set(arr.map((d) => Math.round(d.area)))].sort((a, b) => a - b),
    });
  }
  return out;
}
