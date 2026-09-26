import { describe, expect, it } from 'vitest';
import { dealKey, explainError, nameMatches, parseMolitXml, recentMonths } from './parse';

const TRADE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items>
<item><aptDong> </aptDong><aptNm>래미안대치팰리스1단지</aptNm><buildYear>2015</buildYear><cdealDay> </cdealDay><cdealType> </cdealType><dealAmount>   420,000</dealAmount><dealDay>12</dealDay><dealMonth>9</dealMonth><dealYear>2026</dealYear><dealingGbn>중개거래</dealingGbn><excluUseAr>84.97</excluUseAr><floor>12</floor><jibun>1027</jibun><sggCd>11680</sggCd><umdNm>대치동</umdNm></item>
<item><aptNm>은마</aptNm><buildYear>1979</buildYear><cdealDay>26.09.20</cdealDay><cdealType>O</cdealType><dealAmount>250,000</dealAmount><dealDay>3</dealDay><dealMonth>9</dealMonth><dealYear>2026</dealYear><excluUseAr>76.79</excluUseAr><floor>5</floor><jibun>316</jibun><sggCd>11680</sggCd><umdNm>대치동</umdNm></item>
</items><numOfRows>1000</numOfRows><pageNo>1</pageNo><totalCount>2</totalCount></body></response>`;

const RENT = `<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items>
<item><aptNm>파크뷰</aptNm><deposit>40,000</deposit><monthlyRent>0</monthlyRent><dealYear>2026</dealYear><dealMonth>8</dealMonth><dealDay>30</dealDay><excluUseAr>84.9</excluUseAr><floor>3</floor><sggCd>41135</sggCd><umdNm>정자동</umdNm><jibun>1</jibun></item>
<item><aptNm>파크뷰</aptNm><deposit>10,000</deposit><monthlyRent>150</monthlyRent><dealYear>2026</dealYear><dealMonth>8</dealMonth><dealDay>2</dealDay><excluUseAr>59.8</excluUseAr><floor>7</floor><sggCd>41135</sggCd><umdNm>정자동</umdNm><jibun>1</jibun></item>
</items><totalCount>2</totalCount></body></response>`;

const OLD = `<response><header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header><body><items>
<item><거래금액>    82,500</거래금액><건축년도>2004</건축년도><년>2024</년><법정동> 정자동</법정동><아파트>분당 파크뷰</아파트><월>1</월><일>9</일><전용면적>84.87</전용면적><지번>1</지번><지역코드>41135</지역코드><층>11</층></item>
</items><totalCount>1</totalCount></body></response>`;

const AUTH_ERR = `<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>`;

describe('국토부 실거래가 응답 파싱', () => {
  it('매매: 금액 쉼표·공백 제거, 날짜 조립, 해제 거래 표시', () => {
    const p = parseMolitXml(TRADE, 'trade');
    expect(p.ok).toBe(true);
    expect(p.totalCount).toBe(2);
    expect(p.items).toHaveLength(2);
    const [a, b] = p.items;
    expect(a).toMatchObject({ name: '래미안대치팰리스1단지', price: 420000, area: 84.97, floor: '12', date: '2026-09-12', sggCd: '11680', dong: '대치동', cancelled: false });
    expect(b.cancelled).toBe(true);
  });
  it('전월세: 보증금을 가격으로, 월세 분리', () => {
    const p = parseMolitXml(RENT, 'rent');
    expect(p.items.map((d) => [d.price, d.monthlyRent])).toEqual([[40000, 0], [10000, 150]]);
    expect(p.items[0].date).toBe('2026-08-30');
  });
  it('예전 한글 태그 형식도 읽는다', () => {
    const p = parseMolitXml(OLD, 'trade');
    expect(p.ok).toBe(true);
    expect(p.items[0]).toMatchObject({ name: '분당 파크뷰', price: 82500, date: '2024-01-09', dong: '정자동', sggCd: '41135' });
  });
  it('인증키 오류는 실패로 보고 안내 문구를 만든다', () => {
    const p = parseMolitXml(AUTH_ERR, 'trade');
    expect(p.ok).toBe(false);
    expect(p.code).toBe('30');
    expect(explainError(p.code, p.message)).toContain('인증키');
    expect(explainError('22', '')).toContain('한도');
    expect(explainError('99', 'UNKNOWN')).toContain('불러오지 못했어요');
  });
  it('중복 방지 키는 같은 거래면 같고 층이 다르면 다르다', () => {
    const [a] = parseMolitXml(TRADE, 'trade').items;
    expect(dealKey(a)).toBe(a.key);
    expect(dealKey({ ...a, floor: '13' })).not.toBe(a.key);
  });
});

describe('단지명 매칭·기간', () => {
  it('띄어쓰기·아파트·괄호를 무시한다', () => {
    expect(nameMatches('래미안대치팰리스1단지', '래미안 대치 팰리스')).toBe(true);
    expect(nameMatches('분당파크뷰', '분당 파크뷰 아파트')).toBe(true);
    expect(nameMatches('은마', '래미안')).toBe(false);
    expect(nameMatches('아무거나', '')).toBe(true);
  });
  it('최근 n개월 (이번 달 포함, 연도 넘김)', () => {
    expect(recentMonths(3, new Date(2026, 0, 15))).toEqual(['202601', '202512', '202511']);
  });
});
