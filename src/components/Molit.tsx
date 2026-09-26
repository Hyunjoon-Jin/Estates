import { useMemo, useState } from 'react';
import { errorMessage } from '../lib/errors';
import { won, wonS } from '../lib/finance';
import { areaOf, fetchDeals, sameArea, searchNames, type MolitDeal, type MolitKind, type MolitName } from '../lib/molit';
import { LAWD_LOOKUP_URL, lawdCodesFor } from '../lib/regions';
import { sb } from '../lib/supabase';
import type { Complex, PriceRecord } from '../lib/types';
import { useApp } from '../state/AppData';
import { useToast } from './Toast';

export function codesOf(c: Pick<Complex, 'lawd_cd' | 'region'>): string[] {
  return c.lawd_cd ? [c.lawd_cd] : lawdCodesFor(c.region);
}

function rowOf(d: MolitDeal, householdId: string, complexId: string) {
  return {
    household_id: householdId,
    complex_id: complexId,
    date: d.date,
    type: d.kind === 'trade' ? '실거래' : '전세 실거래',
    price_manwon: Math.round(d.price),
    floor: `${d.floor}층 ${d.area.toFixed(2)}㎡`,
    source: 'molit',
    source_key: d.key,
  };
}

/** 이미 기록한 거래는 빼고 넣는다. 반환: 새로 넣은 건수 */
export async function importDeals(deals: MolitDeal[], householdId: string, complexId: string, existing: PriceRecord[]): Promise<number> {
  const have = new Set(existing.map((p) => p.source_key).filter(Boolean));
  const rows = deals.filter((d) => !d.cancelled && !have.has(d.key)).map((d) => rowOf(d, householdId, complexId));
  if (!rows.length) return 0;
  const { error } = await sb().from('price_records').insert(rows);
  // 동시에 두 사람이 같은 거래를 넣으면 중복 키로 막힌다 → 이미 들어간 것이니 괜찮다
  if (error && error.code !== '23505') throw error;
  return rows.length;
}

/** 단지 상세: 국토부 실거래가 불러와서 골라 기록 */
export function MolitImport({ complex }: { complex: Complex }) {
  const { household, prices, reload } = useApp();
  const toast = useToast();
  const [kind, setKind] = useState<MolitKind>('trade');
  const [months, setMonths] = useState(6);
  const [name, setName] = useState(complex.molit_name || complex.name);
  const [code, setCode] = useState(complex.lawd_cd ?? '');
  const [deals, setDeals] = useState<MolitDeal[] | null>(null);
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [areaF, setAreaF] = useState<number | null>(areaOf(complex.area));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const codes = codesOf({ lawd_cd: code || null, region: complex.region });
  const mine = useMemo(() => prices.filter((p) => p.complex_id === complex.id), [prices, complex.id]);
  const recorded = useMemo(() => new Set(mine.map((p) => p.source_key).filter(Boolean)), [mine]);

  const areas = useMemo(() => [...new Set((deals ?? []).map((d) => Math.round(d.area)))].sort((a, b) => a - b), [deals]);
  const shown = (deals ?? []).filter((d) => sameArea(d.area, areaF));

  const load = async () => {
    setErr('');
    if (!codes.length) return setErr('시군구 코드(5자리)를 먼저 넣어주세요.');
    setBusy(true);
    try {
      if (code && code !== complex.lawd_cd) await sb().from('complexes').update({ lawd_cd: code }).eq('id', complex.id);
      const r = await fetchDeals({ lawdCds: codes, months, kind, name });
      setDeals(r.deals);
      if (r.errors.length) setErr(r.errors[0]);
      // 기본 선택: 아직 기록 안 한 정상 거래 중 면적대가 맞는 것 (전세는 월세 제외)
      setPick(new Set(r.deals.filter((d) => !d.cancelled && !recorded.has(d.key) && (kind === 'trade' || d.monthlyRent === 0) && sameArea(d.area, areaF)).map((d) => d.key)));
      const names = [...new Set(r.deals.map((d) => d.name))];
      if (names.length === 1 && names[0] !== complex.molit_name) await sb().from('complexes').update({ molit_name: names[0] }).eq('id', complex.id);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!household || !deals) return;
    const chosen = deals.filter((d) => pick.has(d.key));
    setBusy(true);
    try {
      const n = await importDeals(chosen, household.id, complex.id, mine);
      toast(n ? `실거래 ${n}건을 기록했어요` : '새로 기록할 거래가 없어요');
      void reload('price_records');
      void reload('complexes');
      setPick(new Set());
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (k: string) => setPick((s) => {
    const n = new Set(s);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });

  return (
    <section className="molit" aria-labelledby={`molit-${complex.id}`}>
      <h3 id={`molit-${complex.id}`} style={{ margin: '14px 0 4px' }}>국토부 실거래가 불러오기</h3>
      <p className="hint" style={{ marginTop: 0 }}>계약 후 30일 안에 신고된 거래예요. 최근 한두 달은 아직 덜 올라왔을 수 있어요.</p>
      <div className="row" style={{ gap: 8, margin: '6px 0' }}>
        <div className="seg" role="group" aria-label="거래 종류">
          <button type="button" aria-pressed={kind === 'trade'} onClick={() => { setKind('trade'); setDeals(null); }}>매매</button>
          <button type="button" aria-pressed={kind === 'rent'} onClick={() => { setKind('rent'); setDeals(null); }}>전월세</button>
        </div>
        <select aria-label="조회 기간" value={months} onChange={(e) => setMonths(Number(e.target.value))} style={{ width: 'auto' }}>
          <option value={3}>최근 3개월</option><option value={6}>최근 6개월</option><option value={12}>최근 12개월</option>
        </select>
      </div>
      <div className="grid2">
        <label className="f" htmlFor={`mq-${complex.id}`}><span>단지명 검색어</span>
          <input id={`mq-${complex.id}`} type="text" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="f" htmlFor={`mc-${complex.id}`}><span>시군구 코드</span>
          <input id={`mc-${complex.id}`} type="text" inputMode="numeric" maxLength={5} value={code} placeholder={lawdCodesFor(complex.region).join(', ') || '5자리'} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          <div className="hint">{lawdCodesFor(complex.region).length ? '비우면 지역으로 자동' : <>이 지역은 직접 넣어주세요 · <a href={LAWD_LOOKUP_URL} target="_blank" rel="noopener noreferrer">코드 조회</a></>}</div>
        </label>
      </div>
      <button type="button" className="btn sm" onClick={load} disabled={busy}>{busy ? '불러오는 중…' : '실거래 불러오기'}</button>
      {err && <p className="err" role="alert">{err}</p>}
      {deals && (
        <div style={{ marginTop: 10 }}>
          {areas.length > 1 && (
            <div className="chips" role="group" aria-label="전용면적 필터" style={{ marginBottom: 6 }}>
              <button type="button" className="chip" aria-pressed={areaF == null} onClick={() => setAreaF(null)}>전체</button>
              {areas.map((a) => <button key={a} type="button" className="chip" aria-pressed={areaF != null && Math.abs(a - areaF) <= 3} onClick={() => setAreaF(a)}>{a}㎡</button>)}
            </div>
          )}
          {shown.length ? (
            <ul className="deals">
              {shown.slice(0, 80).map((d) => {
                const done = recorded.has(d.key);
                const wolse = d.kind === 'rent' && d.monthlyRent > 0;
                const disabled = done || d.cancelled || wolse;
                return (
                  <li key={d.key}>
                    <label className={disabled ? 'off' : ''}>
                      <input type="checkbox" checked={pick.has(d.key)} disabled={disabled} onChange={() => toggle(d.key)} aria-label={`${d.date} ${d.floor}층 ${won(d.price)}`} />
                      <span className="grow">
                        <span className="num">{d.date.slice(2).replace(/-/g, '.')}</span> · {d.floor}층 · {d.area.toFixed(1)}㎡
                        {deals.some((x) => x.name !== d.name) && <span className="muted"> · {d.name}</span>}
                        {d.cancelled && <span className="tag bad" style={{ marginLeft: 4 }}>해제</span>}
                        {wolse && <span className="tag" style={{ marginLeft: 4 }}>월세 {d.monthlyRent}</span>}
                        {done && <span className="tag" style={{ marginLeft: 4 }}>기록됨</span>}
                      </span>
                      <b className="num">{wonS(d.price)}</b>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : <p className="small muted">조건에 맞는 거래가 없어요. 검색어를 줄이거나 기간을 늘려보세요.</p>}
          {shown.length > 80 && <p className="hint">최근 80건만 보여줘요.</p>}
          <button type="button" className="btn key sm" onClick={add} disabled={busy || !pick.size} style={{ marginTop: 8 }}>선택한 {pick.size}건 기록에 추가</button>
        </div>
      )}
    </section>
  );
}

/** 단지 추가: 지역 안에서 국토부 단지명 찾기 */
export function MolitNameSearch({ region, lawdCd, query, onPick }: { region: string; lawdCd: string; query: string; onPick: (n: MolitName) => void }) {
  const [list, setList] = useState<MolitName[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const codes = codesOf({ lawd_cd: lawdCd || null, region });

  const run = async () => {
    setErr('');
    if (!codes.length) return setErr('이 지역은 시군구 코드를 먼저 넣어주세요.');
    if (query.trim().length < 2) return setErr('단지 이름을 두 글자 이상 입력해주세요.');
    setBusy(true);
    try {
      const r = await searchNames({ lawdCds: codes, months: 6, kind: 'trade', name: query });
      setList(r.names);
      if (r.errors.length) setErr(r.errors[0]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ margin: '-4px 0 10px' }}>
      <button type="button" className="btn sm ghost" onClick={run} disabled={busy}>{busy ? '찾는 중…' : '국토부 실거래 단지명으로 찾기'}</button>
      {err && <p className="err" role="alert">{err}</p>}
      {list && (list.length ? (
        <ul className="deals" style={{ marginTop: 6 }}>
          {list.map((n) => (
            <li key={`${n.sggCd}${n.name}`}>
              <button type="button" className="pickname" onClick={() => onPick(n)}>
                <span className="grow"><b>{n.name}</b> <span className="small muted">{n.dong} · 6개월 {n.count}건 · {n.areas.join('/')}㎡</span></span>
                {n.latestPrice > 0 && <span className="num small">{wonS(n.latestPrice)}</span>}
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="small muted">최근 6개월 거래 중 이 이름의 단지가 없어요.</p>)}
    </div>
  );
}

/** 시세 탭: 국토부 단지명이 정해진 단지 전부 최근 2개월 새 거래를 기록 */
export function useRefreshAll() {
  const { complexes, prices, household, reload } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const targets = complexes.filter((c) => c.molit_name && codesOf(c).length);

  const run = async () => {
    if (!household || !targets.length) return;
    setBusy(true);
    let added = 0;
    const errors: string[] = [];
    for (const c of targets) {
      const target = areaOf(c.area);
      for (const kind of ['trade', 'rent'] as const) {
        try {
          const r = await fetchDeals({ lawdCds: codesOf(c), months: 2, kind, name: c.molit_name! });
          const exact = r.deals.filter((d) => d.name === c.molit_name && sameArea(d.area, target) && (kind === 'trade' || d.monthlyRent === 0));
          added += await importDeals(exact, household.id, c.id, prices.filter((p) => p.complex_id === c.id));
          errors.push(...r.errors);
        } catch (e) {
          errors.push((e as Error).message);
        }
      }
    }
    setBusy(false);
    void reload('price_records');
    toast(errors.length && !added ? errors[0] : added ? `새 실거래 ${added}건을 기록했어요` : '새로 올라온 실거래가 없어요');
  };

  return { run, busy, count: targets.length };
}
