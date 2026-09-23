import { describe, expect, it } from 'vitest';
import snapshot from '../../../../docs/handoff/03_policy_snapshot.json';
import { acqTax, calcBuy, calcRent, DEFAULT_PARAMS, maxAffordAll, mergeParams, won, type FinInput } from '..';

/** 명세 4.5: 허용 오차 ±1 만원 */
const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);

const P = mergeParams(snapshot.params, snapshot.regulated);

const COMMON: FinInput = {
  gIncome: 6000, bIncome: 5000,
  gCash: 15000, bCash: 10000, parents: 5000,
  debtAnnual: 0, debtBalance: 0,
  homeless: true, firstHome: true, newborn: false, over85: false,
  rate: 4.2, term: 30,
};

describe('snapshot seed와 코드 fallback', () => {
  it('03_policy_snapshot.json 파라미터가 DEFAULT_PARAMS와 같다', () => {
    expect(P).toEqual(DEFAULT_PARAMS);
  });
  it('snapshot 값을 바꾸면 계산이 따라간다 (하드코딩 금지 확인)', () => {
    const loose = mergeParams({ ...snapshot.params, caps: [{ upTo: null, cap: 99999999 }] }, snapshot.regulated);
    const r = calcBuy(180000, '서울 강남구', COMMON, loose);
    expect(r.bind).toBe('DSR');
  });
});

describe('4.5 매매 표', () => {
  const rows = [
    { price: 90000, region: '경기 용인시 수지구', ltvPct: 70, ltvAmt: 63000, cap: 60000, dsr: 54018, bank: 54018, bind: 'DSR', tax: 2970, broker: 450, misc: 480, need: 39882, gap: -9882, monthly: 264 },
    { price: 70000, region: '경기 고양시', ltvPct: 70, ltvAmt: 49000, cap: 60000, dsr: 54018, bank: 49000, bind: 'LTV', tax: 1286, broker: 280, misc: 440, need: 23006, gap: 6994, monthly: 240 },
    { price: 55000, region: '경기 성남시 분당구', ltvPct: 70, ltvAmt: 38500, cap: 60000, dsr: 54018, bank: 38500, bind: 'LTV', tax: 605, broker: 220, misc: 410, need: 17735, gap: 12265, monthly: 188 },
    { price: 180000, region: '서울 강남구', ltvPct: 70, ltvAmt: 126000, cap: 40000, dsr: 54018, bank: 40000, bind: '주택가격별 한도', tax: 5940, broker: 1260, misc: 660, need: 147860, gap: -117860, monthly: 196 },
  ];
  for (const t of rows) {
    it(`${t.region} ${won(t.price)}`, () => {
      const r = calcBuy(t.price, t.region, COMMON, P);
      expect(r.ltvPct).toBe(t.ltvPct);
      near(r.ltvAmt, t.ltvAmt);
      near(r.cap, t.cap);
      near(r.dsrAmt, t.dsr);
      near(r.bank, t.bank);
      expect(r.bind).toBe(t.bind);
      near(r.tax.total, t.tax);
      near(r.broker, t.broker);
      near(r.misc, t.misc);
      near(r.need, t.need);
      near(r.gap, t.gap);
      near(r.monthly, t.monthly);
    });
  }
});

describe('4.5 추가 케이스', () => {
  it('1) 최대 매수가', () => {
    const m = maxAffordAll(COMMON, P);
    expect(m.reg).toBe(81000);
    expect(m.metro).toBe(81000);
    expect(m.local).toBe(94500);
  });

  it('2) 소득 5,000/3,000 + 출산, 분당 55,000', () => {
    const r = calcBuy(55000, '경기 성남시 분당구', { ...COMMON, gIncome: 5000, bIncome: 3000, newborn: true }, P);
    const [newborn, didim, bogeum] = r.programs;
    expect(newborn.ok).toBe(true);
    near(newborn.amt, 38500);
    expect(didim.ok).toBe(true);
    near(didim.amt, 32000);
    expect(bogeum.ok).toBe(false);
    expect(bogeum.reasons.join()).toContain('소득');
    near(r.best, 38500);
    expect(r.bestName).toBe('은행 주담대');
  });

  it('3) 전세 40,000 분당, 소득 4,000/3,000', () => {
    const r = calcRent(40000, '경기 성남시 분당구', { ...COMMON, gIncome: 4000, bIncome: 3000 }, P);
    expect(r.bestName).toBe('은행 전세대출');
    near(r.best, 32000);
    const butteok = r.programs.find((g) => g.key === 'butteokNewly')!;
    expect(butteok.ok).toBe(true);
    near(butteok.amt, 30000);
    near(r.broker, 120);
    near(r.need, 8420);
    near(r.gap, 21580);
  });

  it('4) 취득세', () => {
    near(acqTax(60000, false, false).total, 660);
    expect(acqTax(60000, false, false).rate).toBe(1);
    near(acqTax(75000, false, false).total, 1650);
    expect(acqTax(75000, false, false).rate).toBe(2);
    near(acqTax(100000, true, false).total, 3500);
    near(acqTax(50000, false, true).total, 350);
  });
});

describe('기타 규칙', () => {
  it('유주택 + 수도권이면 은행 주담대 0 과 경고', () => {
    const r = calcBuy(70000, '경기 고양시', { ...COMMON, homeless: false }, P);
    expect(r.bank).toBe(0);
    expect(r.warnHomeOwner).toBe(true);
  });
  it('reg_override 가 목록보다 우선한다', () => {
    expect(calcBuy(70000, '경기 고양시', COMMON, P, 'yes').reg).toBe(true);
    expect(calcBuy(70000, '서울 강남구', COMMON, P, 'no').reg).toBe(false);
  });
  it('수동 스트레스 금리를 쓴다', () => {
    expect(calcBuy(70000, '경기 고양시', { ...COMMON, stress: 1.5 }, P).stress).toBe(1.5);
    expect(calcBuy(70000, '경기 고양시', { ...COMMON, stress: '' }, P).stress).toBe(3);
  });
  it('won 표기', () => {
    expect(won(72000)).toBe('7억 2,000만원');
    expect(won(70000)).toBe('7억원');
    expect(won(3000)).toBe('3,000만원');
    expect(won(-9882)).toBe('−9,882만원');
    expect(won(0)).toBe('0원');
  });
});
