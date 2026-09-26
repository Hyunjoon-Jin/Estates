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
  if (!res.ok) throw new Error(out.message ?? (res.status === 403 ? '가정 구성원만 조회할 수 있어요.' : '실거래가를 불러오지 못했어요. 잠시 뒤 다시 시도해주세요.'));
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
