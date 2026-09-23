import type { Params } from './types';

/**
 * fallback 기본값. 실제 계산은 policy_snapshot.params 를 우선 쓴다 (mergeParams).
 * 값은 docs/handoff/03_policy_snapshot.json (2026-09-23) 과 같다.
 */
export const DEFAULT_PARAMS: Params = {
  dsr: 40,
  ltv: { reg: 40, regFirst: 70, metro: 70, metroFirst: 70, local: 70, localFirst: 80 },
  caps: [
    { upTo: 150000, cap: 60000 },
    { upTo: 250000, cap: 40000 },
    { upTo: null, cap: 20000 },
  ],
  stress: { metro: 3.0, local: 0.75 },
  maxTermMetro: 30,
  programs: {
    newborn: { incomeSingle: 13000, incomeDual: 20000, priceMax: 90000, max: 40000, ltv: 70 },
    didimNewly: { income: 8500, priceMax: 60000, max: 32000, netAsset: 51100, ltv: 70 },
    bogeum: { income: 7000, priceMax: 60000, max: 36000, maxFirst: 42000, ltv: 70 },
    butteokNewly: { income: 7500, netAsset: 34500, maxMetro: 30000, maxLocal: 20000, ratio: 80 },
    newbornJeonse: { incomeSingle: 13000, incomeDual: 20000, depositMetro: 50000, max: 24000, ratio: 80 },
    bankJeonse: { ratio: 80, max: 50000 },
  },
  regulated: [
    '서울 *', '경기 과천시', '경기 광명시', '경기 성남시 분당구', '경기 성남시 수정구', '경기 성남시 중원구',
    '경기 수원시 영통구', '경기 수원시 장안구', '경기 수원시 팔달구', '경기 안양시 동안구', '경기 용인시 수지구',
    '경기 의왕시', '경기 하남시', '경기 화성시 동탄구', '경기 용인시 기흥구', '경기 구리시',
  ],
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** policy_snapshot 행의 params/regulated 를 기본값 위에 덮어쓴다. 빠진 키는 기본값을 쓴다. */
export function mergeParams(
  params?: DeepPartial<Omit<Params, 'regulated'>> | null,
  regulated?: string[] | null,
): Params {
  const p = (params ?? {}) as DeepPartial<Params>;
  const d = DEFAULT_PARAMS;
  const progs = (p.programs ?? {}) as DeepPartial<Params['programs']>;
  return {
    dsr: p.dsr ?? d.dsr,
    maxTermMetro: p.maxTermMetro ?? d.maxTermMetro,
    ltv: { ...d.ltv, ...(p.ltv ?? {}) } as Params['ltv'],
    stress: { ...d.stress, ...(p.stress ?? {}) } as Params['stress'],
    caps: Array.isArray(p.caps) && p.caps.length ? (p.caps as Params['caps']) : d.caps,
    programs: {
      newborn: { ...d.programs.newborn, ...(progs.newborn ?? {}) },
      didimNewly: { ...d.programs.didimNewly, ...(progs.didimNewly ?? {}) },
      bogeum: { ...d.programs.bogeum, ...(progs.bogeum ?? {}) },
      butteokNewly: { ...d.programs.butteokNewly, ...(progs.butteokNewly ?? {}) },
      newbornJeonse: { ...d.programs.newbornJeonse, ...(progs.newbornJeonse ?? {}) },
      bankJeonse: { ...d.programs.bankJeonse, ...(progs.bankJeonse ?? {}) },
    } as Params['programs'],
    regulated: Array.isArray(regulated) && regulated.length ? regulated : d.regulated,
  };
}
