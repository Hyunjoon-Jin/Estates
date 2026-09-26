// 국토교통부 아파트 매매·전월세 실거래가 API 응답 파싱 (Deno·Vitest 공용, 런타임 의존 없음)
// 응답은 XML. 필드는 영문 태그(aptNm, dealAmount, ...)이고, 예전 형식의 한글 태그도 함께 받는다.

export type Kind = 'trade' | 'rent';

export interface Deal {
  kind: Kind;
  name: string;         // 단지명 (aptNm)
  dong: string;         // 법정동 (umdNm)
  jibun: string;
  sggCd: string;        // 시군구 코드 (LAWD_CD)
  area: number;         // 전용면적 ㎡
  floor: string;
  date: string;         // YYYY-MM-DD
  price: number;        // 매매가 또는 보증금, 만원
  monthlyRent: number;  // 월세, 만원 (매매는 0)
  buildYear: string;
  cancelled: boolean;   // 해제된 거래
  key: string;          // 중복 방지 키
}

export interface ParsedPage {
  ok: boolean;
  code: string;
  message: string;
  totalCount: number;
  items: Deal[];
}

const TAGS: Record<string, string[]> = {
  name: ['aptNm', '아파트'],
  dong: ['umdNm', '법정동'],
  jibun: ['jibun', '지번'],
  sggCd: ['sggCd', '지역코드'],
  area: ['excluUseAr', '전용면적'],
  floor: ['floor', '층'],
  year: ['dealYear', '년'],
  month: ['dealMonth', '월'],
  day: ['dealDay', '일'],
  dealAmount: ['dealAmount', '거래금액'],
  deposit: ['deposit', '보증금액'],
  monthlyRent: ['monthlyRent', '월세금액'],
  buildYear: ['buildYear', '건축년도'],
  cdealType: ['cdealType', '해제여부'],
};

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .trim();
}

function tag(xml: string, names: string[]): string {
  for (const t of names) {
    const m = xml.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`));
    if (m) return decode(m[1]);
  }
  return '';
}

function num(s: string): number {
  const x = Number(s.replace(/,/g, '').trim());
  return Number.isFinite(x) ? x : 0;
}

export function parseMolitXml(xml: string, kind: Kind): ParsedPage {
  const code = tag(xml, ['resultCode', 'returnReasonCode']);
  const message = tag(xml, ['resultMsg', 'returnAuthMsg', 'errMsg']);
  // 정상 코드는 '00' 또는 '000'. 인증키 오류 등은 <OpenAPI_ServiceResponse> 로 온다.
  const ok = /^0+$/.test(code) && !/<OpenAPI_ServiceResponse>/.test(xml);
  const totalCount = num(tag(xml, ['totalCount']));
  const items: Deal[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const it = m[1];
    const g = (k: keyof typeof TAGS) => tag(it, TAGS[k]);
    const y = g('year'), mo = g('month').padStart(2, '0'), d = g('day').padStart(2, '0');
    const price = kind === 'trade' ? num(g('dealAmount')) : num(g('deposit'));
    const deal: Deal = {
      kind,
      name: g('name'),
      dong: g('dong'),
      jibun: g('jibun'),
      sggCd: g('sggCd'),
      area: num(g('area')),
      floor: g('floor'),
      date: y ? `${y}-${mo}-${d}` : '',
      price,
      monthlyRent: kind === 'rent' ? num(g('monthlyRent')) : 0,
      buildYear: g('buildYear'),
      cancelled: /^(O|Y)$/i.test(g('cdealType')),
      key: '',
    };
    deal.key = dealKey(deal);
    if (deal.name && deal.price > 0 && deal.date) items.push(deal);
  }
  return { ok, code, message, totalCount, items };
}

/** 같은 거래를 두 번 기록하지 않기 위한 키 */
export function dealKey(d: Pick<Deal, 'kind' | 'sggCd' | 'dong' | 'jibun' | 'name' | 'date' | 'floor' | 'area' | 'price' | 'monthlyRent'>): string {
  return ['molit', d.kind, d.sggCd, d.dong, d.jibun, d.name, d.date, d.floor, d.area.toFixed(2), d.price, d.monthlyRent].join('|');
}

/** 단지명 비교용: 공백·괄호·'아파트' 제거, 소문자 */
export function normName(s: string): string {
  return s.replace(/\(.*?\)/g, '').replace(/아파트/g, '').replace(/[\s·.\-_]/g, '').toLowerCase();
}

/** 검색어가 단지명에 들어 있으면 일치 (띄어쓰기·'아파트' 무시) */
export function nameMatches(dealName: string, query: string): boolean {
  const a = normName(dealName), q = normName(query);
  if (!q) return true;
  return a.includes(q) || q.includes(a);
}

/** 오늘 기준 최근 n개월의 YYYYMM 목록 (이번 달 포함) */
export function recentMonths(n: number, today = new Date()): string[] {
  const out: string[] = [];
  const d = new Date(today.getFullYear(), today.getMonth(), 1);
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

/** 인증키·한도 오류를 사람이 고칠 수 있는 말로 (data.go.kr 공통 오류 코드) */
export function explainError(code: string, message: string): string {
  const c = code.replace(/^0+(?=\d)/, '');
  const has = (w: string) => message.toUpperCase().includes(w);
  if (c === '30' || has('SERVICE_KEY_IS_NOT_REGISTERED') || has('SERVICE KEY IS NOT REGISTERED'))
    return '공공데이터포털 인증키가 등록되지 않았어요. 활용신청 승인 여부와 Supabase Secrets 의 MOLIT_SERVICE_KEY 값을 확인해주세요.';
  if (c === '22' || has('LIMITED_NUMBER_OF_SERVICE_REQUESTS'))
    return '오늘 조회 한도를 다 썼어요. 내일 다시 시도하거나 공공데이터포털에서 트래픽 증가를 신청해주세요.';
  if (c === '12' || c === '20' || has('NO_OPENAPI_SERVICE') || has('SERVICE_ACCESS_DENIED'))
    return '이 API 활용신청이 안 되어 있어요. 공공데이터포털에서 아파트 매매·전월세 실거래가 자료를 각각 신청해주세요.';
  if (c === '31' || has('DEADLINE_HAS_EXPIRED'))
    return '공공데이터포털 활용기간이 끝났어요. 마이페이지에서 연장 신청해주세요.';
  return `실거래가를 불러오지 못했어요 (${code || '응답 오류'} ${message}).`.replace(/\s+\)/, ')');
}
