// 국토부 아파트 매매·전월세 실거래가 조회 프록시.
// 인증키(MOLIT_SERVICE_KEY)는 Supabase Secrets 에만 둔다. 같은 달 결과는 public.molit_cache 에 캐시해 조회 한도를 아낀다.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { explainError, nameMatches, parseMolitXml, recentMonths, type Deal, type Kind } from './parse.ts';

const SERVICES: Record<Kind, string> = {
  trade: 'RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade',
  rent: 'RTMSDataSvcAptRent/getRTMSDataSvcAptRent',
};
const MAX_CALLS = 30;           // 한 요청에서 API 를 부르는 최대 횟수
const ROWS = 1000;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });

/** 이번 달·지난달은 신고가 계속 들어오니 6시간, 그 전 달은 7일 */
function ttlMs(ymd: string, now = new Date()): number {
  const cur = recentMonths(2, now);
  return cur.includes(ymd) ? 6 * 3600e3 : 7 * 86400e3;
}

function keyParam(raw: string): string {
  // 포털의 'Encoding' 키(이미 % 인코딩됨)와 'Decoding' 키 둘 다 받는다
  return raw.includes('%') ? raw : encodeURIComponent(raw);
}

async function fetchMonth(key: string, kind: Kind, lawd: string, ymd: string): Promise<{ items: Deal[]; calls: number; error?: string }> {
  const items: Deal[] = [];
  let calls = 0;
  for (let page = 1; page <= 10; page++) {
    const url = `https://apis.data.go.kr/1613000/${SERVICES[kind]}?serviceKey=${keyParam(key)}&LAWD_CD=${lawd}&DEAL_YMD=${ymd}&pageNo=${page}&numOfRows=${ROWS}`;
    calls++;
    const res = await fetch(url, { headers: { Accept: 'application/xml' } });
    const xml = await res.text();
    const p = parseMolitXml(xml, kind);
    if (!p.ok) return { items, calls, error: explainError(p.code, p.message) };
    items.push(...p.items);
    if (page * ROWS >= p.totalCount) break;
  }
  return { items, calls };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const serviceKey = Deno.env.get('MOLIT_SERVICE_KEY');
  if (!serviceKey) return json({ error: 'not_configured', message: '실거래가 조회가 아직 설정되지 않았어요. 공공데이터포털 인증키를 Supabase Secrets 에 MOLIT_SERVICE_KEY 로 넣어주세요.' }, 503);

  // 가정 구성원만 (verify_jwt 로 로그인은 이미 확인됨)
  const url = Deno.env.get('SUPABASE_URL')!;
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: member } = await asUser.from('household_members').select('household_id').limit(1).maybeSingle();
  if (!member) return json({ error: 'not_member' }, 403);

  let body: { lawdCds?: unknown; months?: unknown; kind?: unknown; name?: unknown; mode?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'bad_request' }, 400); }
  const lawdCds = (Array.isArray(body.lawdCds) ? body.lawdCds : []).map(String).filter((c) => /^\d{5}$/.test(c)).slice(0, 4);
  const months = Math.min(12, Math.max(1, Math.round(Number(body.months) || 3)));
  const kind: Kind = body.kind === 'rent' ? 'rent' : 'trade';
  const name = String(body.name ?? '').slice(0, 40);
  const mode = body.mode === 'names' ? 'names' : 'deals';
  if (!lawdCds.length) return json({ error: 'no_region', message: '이 지역의 법정동 코드가 없어요. 단지 정보에서 시군구 코드(5자리)를 넣어주세요.' }, 400);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const all: Deal[] = [];
  const errors: string[] = [];
  let calls = 0;
  let cached = 0;

  outer: for (const lawd of lawdCds) {
    for (const ymd of recentMonths(months)) {
      const { data: hit } = await admin.from('molit_cache').select('items, fetched_at').eq('lawd_cd', lawd).eq('ymd', ymd).eq('kind', kind).maybeSingle();
      if (hit && Date.now() - new Date(hit.fetched_at).getTime() < ttlMs(ymd)) {
        all.push(...(hit.items as Deal[]));
        cached++;
        continue;
      }
      if (calls >= MAX_CALLS) { errors.push('조회 범위가 넓어 일부 달은 건너뛰었어요. 기간을 줄여주세요.'); break outer; }
      const r = await fetchMonth(serviceKey, kind, lawd, ymd);
      calls += r.calls;
      if (r.error) { errors.push(r.error); break outer; }
      all.push(...r.items);
      await admin.from('molit_cache').upsert({ lawd_cd: lawd, ymd, kind, items: r.items, fetched_at: new Date().toISOString() });
    }
  }

  const matched = all.filter((d) => nameMatches(d.name, name));

  if (mode === 'names') {
    const by = new Map<string, { name: string; sggCd: string; dong: string; count: number; latestDate: string; latestPrice: number; areas: Set<number> }>();
    for (const d of matched) {
      const k = `${d.sggCd}|${d.name}`;
      const e = by.get(k) ?? { name: d.name, sggCd: d.sggCd, dong: d.dong, count: 0, latestDate: '', latestPrice: 0, areas: new Set<number>() };
      e.count++;
      e.areas.add(Math.round(d.area));
      if (d.date > e.latestDate && !d.cancelled) { e.latestDate = d.date; e.latestPrice = d.price; }
      by.set(k, e);
    }
    const names = [...by.values()]
      .map((e) => ({ ...e, areas: [...e.areas].sort((a, b) => a - b) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);
    return json({ names, calls, cached, errors });
  }

  matched.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return json({ deals: matched.slice(0, 300), total: matched.length, calls, cached, errors });
});
