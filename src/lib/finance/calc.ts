import { acqTax, brokerBuy, brokerRent } from './costs';
import { wonS } from './format';
import { annualFactor, capFor, monthlyPay } from './loan';
import { n } from './num';
import { isMetro, isReg } from './region';
import type { Binding, BuyResult, FinInput, Params, Program, RegOverride, RentResult } from './types';

export const DEFAULT_RATE = 4.2;
export const DEFAULT_TERM = 30;
export const DEFAULT_MOVING = 300;

function moving(f: FinInput): number {
  return f.moving == null || f.moving === '' ? DEFAULT_MOVING : n(f.moving);
}

export function finBase(f: FinInput = {}) {
  const gi = n(f.gIncome);
  const bi = n(f.bIncome);
  const inc = gi + bi;
  const cash = n(f.gCash) + n(f.bCash) + n(f.parents) + n(f.otherAsset);
  const net = cash - n(f.debtBalance);
  return { inc, dual: gi > 0 && bi > 0, cash, net };
}

/** 매매 (명세 4.2) */
export function calcBuy(priceIn: unknown, region: string | null | undefined, f: FinInput, p: Params, override?: RegOverride): BuyResult {
  const price = n(priceIn);
  const reg = isReg(region, override, p);
  const metro = isMetro(region) || reg;
  const { inc, dual, cash, net } = finBase(f);
  const first = !!f.firstHome;
  const homeless = f.homeless !== false;

  const ltvPct = reg
    ? first ? p.ltv.regFirst : p.ltv.reg
    : metro ? first ? p.ltv.metroFirst : p.ltv.metro
    : first ? p.ltv.localFirst : p.ltv.local;
  const ltvAmt = (price * ltvPct) / 100;
  const cap = metro ? capFor(price, p) : Infinity;
  const rate = n(f.rate) || DEFAULT_RATE;
  const term = metro ? Math.min(n(f.term) || DEFAULT_TERM, p.maxTermMetro) : n(f.term) || DEFAULT_TERM;
  const manualStress = f.stress !== '' && f.stress != null && !Number.isNaN(Number(f.stress));
  const stress = manualStress ? Number(f.stress) : metro ? p.stress.metro : p.stress.local;
  const room = Math.max(0, (inc * p.dsr) / 100 - n(f.debtAnnual));
  const dsrAmt = room / annualFactor(rate + stress, term);

  let bank = Math.min(ltvAmt, cap, dsrAmt);
  let bind: Binding = bank === dsrAmt ? 'DSR' : bank === cap ? '주택가격별 한도' : 'LTV';
  const warnHomeOwner = !homeless && metro;
  if (warnHomeOwner) {
    bank = 0;
    bind = '보유주택';
  }

  const over85 = f.over85 === true;
  const pr = p.programs;
  const programs: Program[] = [];
  {
    const q = pr.newborn;
    const rs: string[] = [];
    if (!f.newborn) rs.push('2년 내 출산·입양 가구만');
    if (inc > (dual ? q.incomeDual : q.incomeSingle)) rs.push('소득 기준 초과');
    if (price > q.priceMax) rs.push(`주택가격 ${wonS(q.priceMax)} 초과`);
    if (over85) rs.push('전용 85㎡ 초과');
    if (!homeless) rs.push('무주택 요건');
    programs.push({ key: 'newborn', name: '신생아 특례 디딤돌', ok: !rs.length, reasons: rs, amt: Math.min(q.max, (price * q.ltv) / 100, cap) });
  }
  {
    const q = pr.didimNewly;
    const rs: string[] = [];
    if (inc > q.income) rs.push(`부부합산 소득 ${wonS(q.income)} 초과`);
    if (price > q.priceMax) rs.push(`주택가격 ${wonS(q.priceMax)} 초과`);
    if (net > q.netAsset) rs.push('순자산 기준 초과');
    if (over85) rs.push('전용 85㎡ 초과');
    if (!homeless) rs.push('무주택 요건');
    programs.push({ key: 'didimNewly', name: '신혼 디딤돌', ok: !rs.length, reasons: rs, amt: Math.min(q.max, (price * q.ltv) / 100, cap) });
  }
  {
    const q = pr.bogeum;
    const rs: string[] = [];
    if (inc > q.income) rs.push(`소득 ${wonS(q.income)} 초과`);
    if (price > q.priceMax) rs.push(`주택가격 ${wonS(q.priceMax)} 초과`);
    programs.push({
      key: 'bogeum', name: '보금자리론', ok: !rs.length, reasons: rs,
      amt: Math.min(first ? q.maxFirst : q.max, (price * Math.min(q.ltv, ltvPct)) / 100, cap),
    });
  }

  let best = bank;
  let bestName = '은행 주담대';
  for (const g of programs) if (g.ok && g.amt > best) { best = g.amt; bestName = g.name; }

  const tax = acqTax(price, over85, !!f.acqRelief);
  const broker = brokerBuy(price);
  const misc = price * 0.002 + moving(f);
  const costs = tax.total + broker + misc;
  const need = price - best + costs;
  return {
    price, reg, metro, ltvPct, ltvAmt, cap, dsrAmt, bank, bind, rate, term, stress, programs, best, bestName,
    tax, broker, misc, costs, need, cash, gap: cash - need, monthly: monthlyPay(best, rate, term), inc, warnHomeOwner,
  };
}

/** 전세 (명세 4.3) */
export function calcRent(depIn: unknown, region: string | null | undefined, f: FinInput, p: Params, override?: RegOverride): RentResult {
  const dep = n(depIn);
  const reg = isReg(region, override, p);
  const metro = isMetro(region) || reg;
  const { inc, dual, cash, net } = finBase(f);
  const pr = p.programs;
  const programs: Program[] = [];
  {
    const q = pr.butteokNewly;
    const rs: string[] = [];
    if (inc > q.income) rs.push(`부부합산 소득 ${wonS(q.income)} 초과`);
    if (net > q.netAsset) rs.push('순자산 기준 초과');
    programs.push({ key: 'butteokNewly', name: '신혼부부 버팀목', ok: !rs.length, reasons: rs, amt: Math.min(metro ? q.maxMetro : q.maxLocal, (dep * q.ratio) / 100) });
  }
  {
    const q = pr.newbornJeonse;
    const rs: string[] = [];
    if (!f.newborn) rs.push('2년 내 출산·입양 가구만');
    if (inc > (dual ? q.incomeDual : q.incomeSingle)) rs.push('소득 기준 초과');
    if (metro && dep > q.depositMetro) rs.push(`보증금 ${wonS(q.depositMetro)} 초과`);
    programs.push({ key: 'newbornJeonse', name: '신생아 특례 버팀목', ok: !rs.length, reasons: rs, amt: Math.min(q.max, (dep * q.ratio) / 100) });
  }
  const bank = Math.min((dep * pr.bankJeonse.ratio) / 100, pr.bankJeonse.max);
  let best = bank;
  let bestName = '은행 전세대출';
  for (const g of programs) if (g.ok && g.amt > best) { best = g.amt; bestName = g.name; }
  const broker = brokerRent(dep);
  const misc = moving(f);
  const costs = broker + misc;
  const need = dep - best + costs;
  const rate = n(f.rate) || DEFAULT_RATE;
  return { dep, reg, metro, programs, bank, best, bestName, broker, misc, costs, need, cash, gap: cash - need, monthly: (best * rate) / 100 / 12, inc };
}

/** 최대 매수 가능가 (명세 4.4). 가격별 한도 때문에 계단형이라 선형 탐색. */
export function maxAfford(region: string, f: FinInput, p: Params, override?: RegOverride): number {
  let ok = 0;
  for (let price = 5000; price <= 400000; price += 500) {
    if (calcBuy(price, region, f, p, override).gap >= 0) ok = price;
  }
  return ok;
}

/** 대표 지역 3종 (홈 눈금자·자금 탭 공용) */
export const AFFORD_REGIONS = {
  reg: { label: '규제지역', region: '서울 강남구', override: 'yes' as RegOverride },
  metro: { label: '비규제 수도권', region: '경기 고양시', override: 'no' as RegOverride },
  local: { label: '지방', region: '지방', override: 'no' as RegOverride },
};

export function maxAffordAll(f: FinInput, p: Params) {
  return {
    reg: maxAfford(AFFORD_REGIONS.reg.region, f, p, AFFORD_REGIONS.reg.override),
    metro: maxAfford(AFFORD_REGIONS.metro.region, f, p, AFFORD_REGIONS.metro.override),
    local: maxAfford(AFFORD_REGIONS.local.region, f, p, AFFORD_REGIONS.local.override),
  };
}
