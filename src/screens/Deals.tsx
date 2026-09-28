import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { importDeals } from '../components/Molit';
import { PriceNav } from '../components/PriceNav';
import { RegionSelect } from '../components/RegionSelect';
import { useToast } from '../components/Toast';
import { errorMessage } from '../lib/errors';
import { wonS } from '../lib/finance';
import { fetchDeals, groupByComplex, type ComplexGroup, type MolitDeal, type MolitKind } from '../lib/molit';
import { LAWD_LOOKUP_URL, lawdCodesFor } from '../lib/regions';
import { sb } from '../lib/supabase';
import { useApp } from '../state/AppData';

const SAVE_KEY = 'deals.query';

interface Query {
  region: string;
  code: string;
  kind: MolitKind;
  months: number;
  name: string;
}

function loadQuery(fallbackRegion: string): Query {
  try {
    const q = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
    if (q && typeof q.region === 'string') return { code: '', name: '', kind: 'trade', months: 3, ...q };
  } catch { /* 저장소를 못 쓰면 기본값 */ }
  return { region: fallbackRegion, code: '', kind: 'trade', months: 3, name: '' };
}

function saveQuery(q: Query) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(q)); } catch { /* 무시 */ }
}

function DealRow({ d, showName }: { d: MolitDeal; showName?: boolean }) {
  const wolse = d.kind === 'rent' && d.monthlyRent > 0;
  return (
    <li className={`dealrow ${d.cancelled ? 'off' : ''}`}>
      <span className="grow">
        <span className="num">{d.date.slice(2).replace(/-/g, '.')}</span> · {d.floor}층 · {d.area.toFixed(1)}㎡
        {showName && <span className="muted"> · {d.name}</span>}
        {d.cancelled && <span className="tag bad" style={{ marginLeft: 4 }}>해제</span>}
        {wolse && <span className="tag" style={{ marginLeft: 4 }}>월세 {d.monthlyRent}</span>}
      </span>
      <b className="num">{wonS(d.price)}</b>
    </li>
  );
}

function GroupCard({ g, kind, region }: { g: ComplexGroup; kind: MolitKind; region: string }) {
  const { complexes, prices, household, reload } = useApp();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const mine = complexes.find((c) => c.molit_name === g.name && (!c.lawd_cd || c.lawd_cd === g.sggCd));
  const usable = g.deals.filter((d) => !d.cancelled && (kind === 'trade' || d.monthlyRent === 0));

  const add = async () => {
    if (!household) return;
    setBusy(true);
    try {
      let cid = mine?.id;
      if (!cid) {
        const { data, error } = await sb().from('complexes').insert({
          household_id: household.id, name: g.name, region: region || null, lawd_cd: g.sggCd || null, molit_name: g.name,
        }).select('id').single();
        if (error) throw error;
        cid = data.id as string;
      }
      const n = await importDeals(usable, household.id, cid!, prices.filter((p) => p.complex_id === cid));
      toast(mine ? (n ? `실거래 ${n}건을 기록했어요` : '새로 기록할 거래가 없어요') : `관심 단지에 추가하고 실거래 ${n}건을 기록했어요`);
      void reload('complexes');
      void reload('price_records');
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <button type="button" className="grouphead" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="grow">
          <h3>{g.name} {mine && <span className="tag ok" style={{ marginLeft: 4 }}>관심 단지</span>}</h3>
          <span className="small muted">{g.dong} · {g.deals.length}건 · {g.areas.join('/')}㎡</span>
        </span>
        <span style={{ textAlign: 'right' }}>
          <b className="num">{wonS(g.latest.price)}</b>
          <div className="small muted num">{g.min === g.max ? '' : `${wonS(g.min)}~${wonS(g.max)}`}</div>
        </span>
      </button>
      {open && (
        <>
          <ul className="deals" style={{ marginTop: 8 }}>
            {g.deals.slice(0, 50).map((d) => <DealRow key={d.key} d={d} />)}
          </ul>
          {g.deals.length > 50 && <p className="hint">최근 50건만 보여줘요.</p>}
        </>
      )}
      <div className="row" style={{ marginTop: 8, gap: 6 }}>
        <button type="button" className="btn sm" onClick={() => setOpen((o) => !o)}>{open ? '접기' : `거래 ${g.deals.length}건 보기`}</button>
        <button type="button" className={`btn sm ${mine ? '' : 'key'}`} onClick={add} disabled={busy || !usable.length}>
          {busy ? '저장 중…' : mine ? '시세 기록에 추가' : '관심 단지로 담기'}
        </button>
      </div>
    </div>
  );
}

export function Deals() {
  const { complexes, params } = useApp();
  const [q, setQ] = useState<Query>(() => loadQuery(complexes.find((c) => lawdCodesFor(c.region).length)?.region ?? '경기 성남시 분당구'));
  const [deals, setDeals] = useState<MolitDeal[] | null>(null);
  const [total, setTotal] = useState(0);
  const [view, setView] = useState<'complex' | 'deal'>('complex');
  const [sort, setSort] = useState<'recent' | 'count' | 'price'>('recent');
  const [areaF, setAreaF] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ msg: string; setup?: boolean } | null>(null);
  const autoCodes = lawdCodesFor(q.region);
  const codes = /^\d{5}$/.test(q.code) ? [q.code] : autoCodes;
  const set = <K extends keyof Query>(k: K, v: Query[K]) => setQ((x) => ({ ...x, [k]: v }));

  const run = async () => {
    setErr(null);
    if (!codes.length) return setErr({ msg: '이 지역은 시군구 코드(5자리)를 직접 넣어주세요.' });
    saveQuery(q);
    setBusy(true);
    try {
      const r = await fetchDeals({ lawdCds: codes, months: q.months, kind: q.kind, name: q.name.trim(), limit: 1000 });
      setDeals(r.deals);
      setTotal(r.total);
      setAreaF(null);
      if (r.errors.length) setErr({ msg: r.errors[0], setup: /인증키|활용신청/.test(r.errors[0]) });
    } catch (e) {
      const code = (e as Error & { code?: string }).code;
      setErr({ msg: (e as Error).message, setup: code === 'not_configured' });
      setDeals(null);
    } finally {
      setBusy(false);
    }
  };

  const areaBuckets = useMemo(() => {
    const counts = new Map<number, number>();
    for (const d of deals ?? []) {
      const a = Math.round(d.area);
      counts.set(a, (counts.get(a) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0] - b[0]).filter(([, n]) => n >= 2).map(([a]) => a).slice(0, 8);
  }, [deals]);

  const filtered = useMemo(() => (deals ?? []).filter((d) => areaF == null || Math.abs(d.area - areaF) <= 3), [deals, areaF]);
  const groups = useMemo(() => {
    const gs = groupByComplex(filtered);
    if (sort === 'count') gs.sort((a, b) => b.deals.length - a.deals.length);
    else if (sort === 'price') gs.sort((a, b) => b.latest.price - a.latest.price);
    else gs.sort((a, b) => (a.latest.date < b.latest.date ? 1 : -1));
    return gs;
  }, [filtered, sort]);
  const flat = useMemo(() => {
    const xs = filtered.slice();
    if (sort === 'price') xs.sort((a, b) => b.price - a.price);
    return xs;
  }, [filtered, sort]);

  return (
    <>
      <PriceNav />
      <div className="card">
        <label className="f" htmlFor="dRegion"><span>지역</span>
          <RegionSelect id="dRegion" value={q.region} params={params} onChange={(v) => setQ((x) => ({ ...x, region: v, code: '' }))} />
        </label>
        {!autoCodes.length && q.region && (
          <label className="f" htmlFor="dCode"><span>시군구 코드 (5자리)</span>
            <input id="dCode" type="text" inputMode="numeric" maxLength={5} value={q.code} onChange={(e) => set('code', e.target.value.replace(/\D/g, ''))} placeholder="예: 41135" />
            <div className="hint">이 지역은 코드를 직접 넣어주세요 · <a href={LAWD_LOOKUP_URL} target="_blank" rel="noopener noreferrer">법정동코드 조회</a> (앞 5자리)</div>
          </label>
        )}
        <label className="f" htmlFor="dName"><span>단지명 (비우면 지역 전체)</span>
          <input id="dName" type="search" maxLength={40} value={q.name} onChange={(e) => set('name', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void run()} placeholder="예: 파크뷰" />
        </label>
        <div className="row" style={{ gap: 8, marginBottom: 10 }}>
          <div className="seg" role="group" aria-label="거래 종류">
            <button type="button" aria-pressed={q.kind === 'trade'} onClick={() => set('kind', 'trade')}>매매</button>
            <button type="button" aria-pressed={q.kind === 'rent'} onClick={() => set('kind', 'rent')}>전월세</button>
          </div>
          <select aria-label="조회 기간" value={q.months} onChange={(e) => set('months', Number(e.target.value))} style={{ width: 'auto' }}>
            <option value={1}>이번 달</option><option value={3}>최근 3개월</option><option value={6}>최근 6개월</option><option value={12}>최근 12개월</option>
          </select>
        </div>
        <button type="button" className="btn key" onClick={run} disabled={busy} style={{ width: '100%' }}>{busy ? '국토부 자료 불러오는 중…' : '실거래 조회'}</button>
        <p className="hint">국토교통부 실거래가 공개자료예요. 계약 후 30일 안에 신고되므로 최근 한두 달은 덜 올라와 있어요.</p>
      </div>

      {err && (
        <div className="card" role="alert" style={{ borderColor: 'var(--bad)' }}>
          <p className="small" style={{ color: 'var(--bad)', margin: 0 }}>{err.msg}</p>
          {err.setup && <p className="hint">설정 방법은 저장소의 docs/OWNER_TODO.md 5-1에 있어요 (Supabase → Edge Functions → Secrets 에 MOLIT_SERVICE_KEY).</p>}
        </div>
      )}

      {deals && (
        <>
          <div className="sec" style={{ marginTop: 14 }}>
            <h2 className="num">{view === 'complex' ? `${groups.length}개 단지` : `${filtered.length}건`}</h2>
            <div className="seg" role="group" aria-label="보기 방식">
              <button type="button" aria-pressed={view === 'complex'} onClick={() => setView('complex')}>단지별</button>
              <button type="button" aria-pressed={view === 'deal'} onClick={() => setView('deal')}>거래별</button>
            </div>
          </div>
          {total > deals.length && <p className="hint" style={{ marginTop: -6 }}>전체 {total.toLocaleString('ko-KR')}건 중 최근 {deals.length.toLocaleString('ko-KR')}건이에요. 단지명을 넣으면 좁혀져요.</p>}
          <div className="chips" role="group" aria-label="정렬" style={{ marginBottom: 6 }}>
            <button type="button" className="chip" aria-pressed={sort === 'recent'} onClick={() => setSort('recent')}>최신순</button>
            {view === 'complex' && <button type="button" className="chip" aria-pressed={sort === 'count'} onClick={() => setSort('count')}>거래 많은 순</button>}
            <button type="button" className="chip" aria-pressed={sort === 'price'} onClick={() => setSort('price')}>가격 높은 순</button>
          </div>
          {areaBuckets.length > 1 && (
            <div className="chips" role="group" aria-label="전용면적" style={{ marginBottom: 10 }}>
              <button type="button" className="chip" aria-pressed={areaF == null} onClick={() => setAreaF(null)}>전체 면적</button>
              {areaBuckets.map((a) => <button key={a} type="button" className="chip" aria-pressed={areaF === a} onClick={() => setAreaF(a)}>{a}㎡</button>)}
            </div>
          )}
          {!filtered.length ? (
            <div className="empty">조건에 맞는 거래가 없어요. 단지명을 줄이거나 기간을 늘려보세요.</div>
          ) : view === 'complex' ? (
            groups.slice(0, 60).map((g) => <GroupCard key={`${g.sggCd}${g.name}`} g={g} kind={q.kind} region={q.region} />)
          ) : (
            <ul className="deals" style={{ maxHeight: 'none' }}>
              {flat.slice(0, 300).map((d) => <DealRow key={d.key} d={d} showName />)}
            </ul>
          )}
          {view === 'complex' && groups.length > 60 && <p className="hint">단지가 많아 60곳만 보여줘요. 단지명으로 좁혀보세요.</p>}
          {filtered.length > 0 && (
            <p className="hint" style={{ marginTop: 10 }}>
              기록한 실거래는 <Link to="/price">관심 단지</Link> 카드의 시세 그래프와 자금 탭 단지 선택에 바로 쓰여요.
            </p>
          )}
        </>
      )}
    </>
  );
}
