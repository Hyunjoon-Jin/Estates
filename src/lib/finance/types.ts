/** 모든 금액 단위는 만원. */

export interface PriceCap {
  upTo: number | null;
  cap: number;
}

export interface Programs {
  newborn: { incomeSingle: number; incomeDual: number; priceMax: number; max: number; ltv: number };
  didimNewly: { income: number; priceMax: number; max: number; netAsset: number; ltv: number };
  bogeum: { income: number; priceMax: number; max: number; maxFirst: number; ltv: number };
  butteokNewly: { income: number; netAsset: number; maxMetro: number; maxLocal: number; ratio: number };
  newbornJeonse: { incomeSingle: number; incomeDual: number; depositMetro: number; max: number; ratio: number };
  bankJeonse: { ratio: number; max: number };
}

export interface Params {
  dsr: number;
  ltv: { reg: number; regFirst: number; metro: number; metroFirst: number; local: number; localFirst: number };
  caps: PriceCap[];
  stress: { metro: number; local: number };
  maxTermMetro: number;
  programs: Programs;
  regulated: string[];
}

/** 자금 탭 입력값 (finances.data). 입력 필드 특성상 문자열도 허용한다. */
export interface FinInput {
  gIncome?: number | string;
  bIncome?: number | string;
  gCash?: number | string;
  bCash?: number | string;
  parents?: number | string;
  otherAsset?: number | string;
  debtAnnual?: number | string;
  debtBalance?: number | string;
  homeless?: boolean;
  firstHome?: boolean;
  newborn?: boolean;
  over85?: boolean;
  acqRelief?: boolean;
  rate?: number | string;
  term?: number | string;
  stress?: number | string | null;
  moving?: number | string | null;
  mode?: 'buy' | 'rent';
  testPrice?: number | string;
  testRegion?: string;
  testOverride?: RegOverride;
}

export type RegOverride = 'yes' | 'no' | null | undefined | '';

export interface Program {
  key: string;
  name: string;
  ok: boolean;
  reasons: string[];
  amt: number;
}

export type Binding = 'LTV' | '주택가격별 한도' | 'DSR' | '보유주택';

export interface BuyResult {
  price: number;
  reg: boolean;
  metro: boolean;
  ltvPct: number;
  ltvAmt: number;
  cap: number;
  dsrAmt: number;
  bank: number;
  bind: Binding;
  rate: number;
  term: number;
  stress: number;
  programs: Program[];
  best: number;
  bestName: string;
  tax: { total: number; rate: number };
  broker: number;
  misc: number;
  costs: number;
  need: number;
  cash: number;
  gap: number;
  monthly: number;
  inc: number;
  warnHomeOwner: boolean;
}

export interface RentResult {
  dep: number;
  reg: boolean;
  metro: boolean;
  programs: Program[];
  bank: number;
  best: number;
  bestName: string;
  broker: number;
  misc: number;
  costs: number;
  need: number;
  cash: number;
  gap: number;
  monthly: number;
  inc: number;
}
