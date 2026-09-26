import type { FinInput, RegOverride } from './finance';

export type Role = 'groom' | 'bride';

export interface Household {
  id: string;
  invite_code: string;
  move_in: string | null;
  created_by: string | null;
  created_at: string;
}
export interface Member {
  household_id: string;
  user_id: string;
  role: Role;
  nick: string | null;
  display_name: string | null;
}
export interface Complex {
  id: string;
  household_id: string;
  name: string;
  region: string | null;
  reg_override: RegOverride;
  area: string | null;
  meta: string | null;
  commute: string | null;
  memo: string | null;
  /** 국토부 실거래가 조회용 시군구 코드 (없으면 지역으로 추정) */
  lawd_cd: string | null;
  /** 국토부 데이터상의 정확한 단지명 */
  molit_name: string | null;
  created_by: string | null;
  created_at: string;
}
export const PRICE_TYPES = ['실거래', '호가', 'KB시세', '전세 실거래', '전세 호가'] as const;
export type PriceType = (typeof PRICE_TYPES)[number];
export interface PriceRecord {
  id: string;
  complex_id: string;
  household_id: string;
  date: string;
  type: PriceType;
  price_manwon: number;
  floor: string | null;
  source?: 'manual' | 'molit' | null;
  source_key?: string | null;
  created_by: string | null;
}
export const RATE_KEYS = [
  ['traffic', '교통'],
  ['noise', '소음·층간'],
  ['light', '채광·향'],
  ['manage', '단지 관리'],
  ['life', '생활 편의'],
] as const;
export type RateKey = (typeof RATE_KEYS)[number][0];
export interface Visit {
  id: string;
  household_id: string;
  complex_id: string | null;
  complex_name: string | null;
  date: string;
  ratings: Partial<Record<RateKey, number>>;
  commute_groom: number | null;
  commute_bride: number | null;
  pros: string | null;
  cons: string | null;
  memo: string | null;
  created_by: string | null;
  created_at: string;
}
export const STATUSES = ['관심', '연락중', '협상중', '가계약', '계약완료', '보류'] as const;
export type Status = (typeof STATUSES)[number];
export interface Candidate {
  id: string;
  household_id: string;
  complex_id: string | null;
  deal_type: '매매' | '전세';
  status: Status;
  unit: string | null;
  area: string | null;
  price_manwon: number | null;
  memo: string | null;
  created_by: string | null;
  created_at: string;
}
export interface CandidateScore {
  candidate_id: string;
  user_id: string;
  score: number;
}
export interface Finances {
  household_id: string;
  data: FinInput;
  updated_by: string | null;
  updated_at: string;
}
export interface PolicyItem {
  date?: string;
  tag?: string;
  title: string;
  summary?: string;
  impact?: string;
  source?: string;
  url?: string;
}
export interface PolicySnapshot {
  id: number;
  updated_at: string;
  headline: string | null;
  items: PolicyItem[];
  params: Record<string, unknown>;
  regulated: string[];
}
