import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Disclaimer } from '../components/Disclaimer';
import { Disclosure } from '../components/Disclosure';
import { MoneyField } from '../components/MoneyField';
import { RegionSelect } from '../components/RegionSelect';
import { useToast } from '../components/Toast';
import { latestPrice } from '../lib/domain';
import { errorMessage } from '../lib/errors';
import {
  calcBuy, calcRent, finBase, maxAffordAll, n, withFinDefaults, won, wonS,
  type BuyResult, type FinInput, type Params, type Program, type RentResult,
} from '../lib/finance';
import { sb } from '../lib/supabase';
import { useApp } from '../state/AppData';

const SAVE_DELAY = 900;

/**
 * 가정 공유 자금 입력. 0.9초 디바운스로 바뀐 키만 patch_finances 로 저장한다.
 * 내가 입력 중(저장 대기·저장 중)일 때는 상대의 실시간 변경으로 덮어쓰지 않는다.
 */
function useFinanceDraft() {
  const { finances, setFinancesLocal } = useApp();
  const toast = useToast();
  const [draft, setDraft] = useState<FinInput>(finances?.data ?? {});
  const [saving, setSaving] = useState(false);
  const pending = useRef<Record<string, unknown>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const busy = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // 상대 변경 반영 (내가 입력 중이 아닐 때만)
  useEffect(() => {
    if (!finances) return;
    if (busy.current || Object.keys(pending.current).length) return;
    setDraft(finances.data ?? {});
  }, [finances]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const patch = pending.current;
    if (!Object.keys(patch).length || busy.current) return;
    pending.current = {};
    busy.current = true;
    setSaving(true);
    const { data, error } = await sb().rpc('patch_finances', { p_patch: patch });
    busy.current = false;
    setSaving(false);
    if (error) {
      // 실패한 변경은 다음 저장에 다시 싣는다
      pending.current = { ...patch, ...pending.current };
      toast(errorMessage(error));
      return;
    }
    if (Object.keys(pending.current).length) {
      timer.current = setTimeout(() => void flush(), SAVE_DELAY);
    } else if (data) {
      setFinancesLocal((data as { data: FinInput }).data);
      setDraft((data as { data: FinInput }).data);
    }
  }, [setFinancesLocal, toast]);

  const set = useCallback(
    (patch: Partial<FinInput>, delay = SAVE_DELAY) => {
      setDraft((d) => {
        const next = { ...d } as Record<string, unknown>;
        for (const [k, v] of Object.entries(patch)) {
          if (v === undefined || v === null || v === '') delete next[k];
          else next[k] = v;
        }
        return next as FinInput;
      });
      for (const [k, v] of Object.entries(patch)) pending.current[k] = v === '' || v === undefined ? null : v;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delay);
    },
    [flush],
  );

  // 화면을 떠날 때 남은 변경 저장
  useEffect(() => () => void flush(), [flush]);

  return { draft, set, saving };
}

function Check({ id, label, hint, checked, onChange }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}{hint && <><br /><span className="hint">{hint}</span></>}</span>
    </label>
  );
}

function Bind({ on }: { on: boolean }) {
  return on ? <> <span className="bind">적용</span></> : null;
}

function Programs({ list }: { list: Program[] }) {
  return (
    <>
      {list.map((g) => (
        <div key={g.key} className="row-line">
          <span>{g.name}</span>
          {g.ok ? <span className="tag ok">대상 · 최대 {wonS(g.amt)}</span> : <span className="small muted" style={{ textAlign: 'right' }}>{g.reasons.join(', ')}</span>}
        </div>
      ))}
    </>
  );
}

function Row({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return <tr><td>{label}{note && <div className="small muted">{note}</div>}</td><td className="num">{children}</td></tr>;
}

function Gap({ gap }: { gap: number }) {
  return (
    <tr className="total"><td>{gap >= 0 ? '여유' : '부족'}</td>
      <td className="num" style={{ color: gap >= 0 ? 'var(--ok)' : 'var(--bad)' }}>{won(Math.abs(Math.round(gap)))}</td></tr>
  );
}

function BuyResultView({ r, p }: { r: BuyResult; p: Params }) {
  const ok = r.gap >= 0;
  return (
    <>
      <div className={`verdict ${ok ? '' : 'no'}`} role="status">
        <div className="small">{r.reg ? '규제지역' : r.metro ? '비규제 수도권' : '지방'} · {won(r.price)}</div>
        <div className="big">{ok ? '살 수 있어요' : `현금이 ${won(-r.gap)} 부족해요`}</div>
        <p className="small">{ok && `여유 ${won(r.gap)} · `}{r.bestName} {won(r.best)} 기준, 월 상환 약 <b className="num">{won(Math.round(r.monthly))}</b> (금리 {r.rate}%, {r.term}년 원리금균등)</p>
      </div>
      <div className="card" style={{ marginTop: 10 }}>
        <h3>은행 주담대 한도 (셋 중 가장 작은 값)</h3>
        <table className="k"><tbody>
          <Row label={`LTV ${r.ltvPct}%`}>{won(r.ltvAmt)}<Bind on={r.bind === 'LTV'} /></Row>
          {r.metro && <Row label="주택가격별 최대 한도" note="수도권·규제지역">{won(r.cap)}<Bind on={r.bind === '주택가격별 한도'} /></Row>}
          <Row label={`DSR ${p.dsr}%`} note={`스트레스 금리 +${r.stress}%p 반영, 부부합산 소득 ${won(r.inc)}`}>{won(Math.round(r.dsrAmt))}<Bind on={r.bind === 'DSR'} /></Row>
          <tr className="total"><td>은행 주담대</td><td className="num">{won(Math.round(r.bank))}</td></tr>
        </tbody></table>
        {r.warnHomeOwner && <p className="small" role="alert" style={{ color: 'var(--bad)' }}>수도권·규제지역에서 무주택이 아니면 추가 구입 대출이 막혀 있어요. 이 계산기는 무주택 기준이에요.</p>}
      </div>
      <div className="card">
        <h3>정책대출 자격</h3>
        <Programs list={r.programs} />
        <p className="hint">디딤돌은 방공제로 실제 한도가 더 줄 수 있어요. 월 상환은 입력한 금리로 계산했어요.</p>
      </div>
      <div className="card">
        <h3>필요한 현금</h3>
        <table className="k"><tbody>
          <Row label="매매가">{won(r.price)}</Row>
          <Row label={`대출 (${r.bestName})`}>−{won(Math.round(r.best))}</Row>
          <Row label="취득세·지방교육세" note={`취득세율 ${r.tax.rate}%`}>{won(Math.round(r.tax.total))}</Row>
          <Row label="중개보수 (상한)">{won(Math.round(r.broker))}</Row>
          <Row label="등기·채권·이사 등">{won(Math.round(r.misc))}</Row>
          <tr className="total"><td>필요 현금</td><td className="num">{won(Math.round(r.need))}</td></tr>
          <Row label="가용자산">{won(r.cash)}</Row>
          <Gap gap={r.gap} />
        </tbody></table>
      </div>
    </>
  );
}

function RentResultView({ r }: { r: RentResult }) {
  const ok = r.gap >= 0;
  return (
    <>
      <div className={`verdict ${ok ? '' : 'no'}`} role="status">
        <div className="small">{r.reg ? '규제지역' : r.metro ? '수도권' : '지방'} · 보증금 {won(r.dep)}</div>
        <div className="big">{ok ? '들어갈 수 있어요' : `현금이 ${won(-r.gap)} 부족해요`}</div>
        <p className="small">{ok && `여유 ${won(r.gap)} · `}{r.bestName} {won(Math.round(r.best))} 기준, 월 이자 약 <b className="num">{won(Math.round(r.monthly))}</b> (입력 금리 기준)</p>
      </div>
      <div className="card" style={{ marginTop: 10 }}>
        <h3>전세대출 자격</h3>
        <Programs list={r.programs} />
        <div className="row-line"><span>은행 전세대출</span><span className="tag">보증금 80% · {wonS(r.bank)}</span></div>
        <p className="hint">은행 전세대출 한도는 보증기관(HUG·HF·SGI)과 소득에 따라 달라요.</p>
      </div>
      <div className="card">
        <h3>필요한 현금</h3>
        <table className="k"><tbody>
          <Row label="보증금">{won(r.dep)}</Row>
          <Row label={`대출 (${r.bestName})`}>−{won(Math.round(r.best))}</Row>
          <Row label="중개보수 (상한)">{won(Math.round(r.broker))}</Row>
          <Row label="이사·기타">{won(r.misc)}</Row>
          <tr className="total"><td>필요 현금</td><td className="num">{won(Math.round(r.need))}</td></tr>
          <Row label="가용자산">{won(r.cash)}</Row>
          <Gap gap={r.gap} />
        </tbody></table>
      </div>
    </>
  );
}

export function Money() {
  const { complexes, prices, params, finances } = useApp();
  const { draft, set, saving } = useFinanceDraft();
  const f = useMemo(() => withFinDefaults(draft), [draft]);
  const mode = f.mode === 'rent' ? 'rent' : 'buy';
  const base = finBase(f);
  const testPrice = n(f.testPrice);
  const region = f.testRegion ?? '';
  const res = testPrice ? (mode === 'rent' ? calcRent(testPrice, region, f, params, f.testOverride) : calcBuy(testPrice, region, f, params, f.testOverride)) : null;
  const max = useMemo(() => (mode === 'buy' && (base.inc > 0 || base.cash > 0) ? maxAffordAll(f, params) : null), [mode, base.inc, base.cash, f, params]);

  const num = (k: keyof FinInput) => (v: string) => set({ [k]: v === '' ? null : Number(v) } as Partial<FinInput>);
  const val = (k: keyof FinInput) => (draft[k] as string | number | undefined) ?? '';

  const pick = (id: string) => {
    const c = complexes.find((x) => x.id === id);
    if (!c) return;
    const lp = latestPrice(c.id, prices, mode);
    set({ testRegion: c.region ?? '', testOverride: c.reg_override ?? null, testPrice: lp ? lp.price_manwon : f.testPrice }, 300);
  };

  // 자금 행을 받기 전에 그리면 '입력 전'으로 보고 칸을 펼쳐버리므로 기다린다
  if (!finances) return <p className="muted" role="status" style={{ padding: '24px 0' }}>자금 정보를 불러오는 중…</p>;

  const incSum = n(f.gIncome) + n(f.bIncome);
  const needsInput = !(base.inc > 0 || base.cash > 0);
  // 칸을 처음 펼칠지는 서버에 저장된 값으로 정한다 (draft 는 한 박자 늦게 채워짐)
  const saved = finBase(finances.data);
  const openInputs = !(saved.inc > 0 || saved.cash > 0);
  const condSummary = [
    f.homeless !== false ? '무주택' : '유주택',
    mode === 'buy' && f.firstHome ? '생애최초' : '',
    f.newborn ? '출산' : '',
    `${n(f.rate) || 4.2}%`,
    mode === 'buy' ? `${n(f.term) || 30}년` : '',
  ].filter(Boolean).join(' · ');

  return (
    <>
      <div className="sec" style={{ marginTop: 4 }}>
        <h2>자금과 대출</h2>
        <div className="seg" role="group" aria-label="거래 방식">
          <button type="button" aria-pressed={mode === 'buy'} onClick={() => set({ mode: 'buy' }, 300)}>매매</button>
          <button type="button" aria-pressed={mode === 'rent'} onClick={() => set({ mode: 'rent' }, 300)}>전세</button>
        </div>
      </div>

      {/* 입력을 고치는 동안에도 답이 보이도록 위에 붙는 요약 */}
      <div className={`sticky-verdict ${res ? (res.gap >= 0 ? 'ok' : 'no') : ''}`} role="status" aria-live="polite">
        {res ? (
          <>
            <b>{res.gap >= 0 ? (mode === 'buy' ? '살 수 있어요' : '들어갈 수 있어요') : `${wonS(-res.gap)} 부족해요`}</b>
            <span className="num">{res.gap >= 0 ? `여유 ${wonS(res.gap)}` : `필요 현금 ${wonS(res.need)}`} · 월 {won(Math.round(res.monthly))}</span>
          </>
        ) : <span>가격과 지역을 넣으면 바로 계산해요</span>}
        <span className="saving">{saving ? '저장 중…' : ''}</span>
      </div>

      <div className="card">
        <h3>어떤 집을 볼까요?</h3>
        {complexes.length > 0 && (
          <>
            <div className="chips" style={{ margin: '6px 0' }}>
              {complexes.slice(0, 8).map((c) => {
                const lp = latestPrice(c.id, prices, mode);
                return <button key={c.id} type="button" className="chip" onClick={() => pick(c.id)}>{c.name.slice(0, 10)}{lp ? ` ${wonS(lp.price_manwon)}` : ''}</button>;
              })}
            </div>
            <p className="hint" style={{ marginTop: 0 }}>단지를 누르면 최근 {mode === 'buy' ? '매매' : '전세'} 시세와 지역이 채워져요.</p>
          </>
        )}
        <div className="grid2">
          <MoneyField id="fin_testPrice" label={mode === 'buy' ? '매매가' : '전세 보증금'} unit="만원" placeholder="85000" value={val('testPrice')} onChange={num('testPrice')} />
          <label className="f" htmlFor="fin_testRegion"><span>지역</span>
            <RegionSelect id="fin_testRegion" value={region} params={params} onChange={(v) => set({ testRegion: v, testOverride: null })} />
          </label>
        </div>
      </div>

      {needsInput && <p className="small" style={{ margin: '4px 2px 10px' }}>아래 <b>우리 조건</b>에 두 사람의 소득과 가용자산을 먼저 넣어주세요.</p>}
      {res && !needsInput && (mode === 'buy' ? <BuyResultView r={res as BuyResult} p={params} /> : <RentResultView r={res as RentResult} />)}

      <div className="sec"><h2>우리 조건</h2><span className="small muted">둘이 같이 고쳐요 · 만원 단위</span></div>
      <Disclosure title="소득 (세전 연봉)" summary={incSum ? wonS(incSum) : '입력 전'} defaultOpen={openInputs}>
        <div className="grid2">
          <MoneyField id="fin_gIncome" label="신랑" unit="만원" value={val('gIncome')} onChange={num('gIncome')} />
          <MoneyField id="fin_bIncome" label="신부" unit="만원" value={val('bIncome')} onChange={num('bIncome')} />
        </div>
      </Disclosure>
      <Disclosure title="가용자산" summary={base.cash ? wonS(base.cash) : '입력 전'} defaultOpen={openInputs}>
        <div className="grid2">
          <MoneyField id="fin_gCash" label="신랑 예금·주식 등" unit="만원" value={val('gCash')} onChange={num('gCash')} />
          <MoneyField id="fin_bCash" label="신부 예금·주식 등" unit="만원" value={val('bCash')} onChange={num('bCash')} />
          <MoneyField id="fin_parents" label="양가 지원" unit="만원" value={val('parents')} onChange={num('parents')} />
          <MoneyField id="fin_otherAsset" label="기타 (전세보증금 반환 등)" unit="만원" value={val('otherAsset')} onChange={num('otherAsset')} />
        </div>
      </Disclosure>
      <Disclosure title="기존 부채" summary={n(f.debtAnnual) || n(f.debtBalance) ? `연 ${wonS(f.debtAnnual)} 상환` : '없음'}>
        <div className="grid2">
          <MoneyField id="fin_debtAnnual" label="연간 원리금 상환액" unit="만원" hint="신용대출·차 할부 등 1년치" value={val('debtAnnual')} onChange={num('debtAnnual')} />
          <MoneyField id="fin_debtBalance" label="부채 잔액" unit="만원" hint="순자산 계산용" value={val('debtBalance')} onChange={num('debtBalance')} />
        </div>
      </Disclosure>
      <Disclosure title="조건·금리" summary={condSummary}>
        <Check id="fin_homeless" label="두 사람 모두 무주택" checked={f.homeless !== false} onChange={(v) => set({ homeless: v })} />
        {mode === 'buy' && <Check id="fin_firstHome" label="생애최초 주택 구입" hint="두 사람 모두 집을 가져본 적 없을 때" checked={!!f.firstHome} onChange={(v) => set({ firstHome: v })} />}
        <Check id="fin_newborn" label="2년 안에 출산(예정)한 아이가 있음" hint="신생아 특례 대출 대상 여부" checked={!!f.newborn} onChange={(v) => set({ newborn: v })} />
        {mode === 'buy' && <Check id="fin_over85" label="전용 85㎡ 초과 주택" checked={!!f.over85} onChange={(v) => set({ over85: v })} />}
        {mode === 'buy' && <Check id="fin_acqRelief" label="생애최초 취득세 감면 반영 (최대 200만원)" hint="감면 연장 여부를 확인한 뒤 켜세요" checked={!!f.acqRelief} onChange={(v) => set({ acqRelief: v })} />}
        <div className="grid2" style={{ marginTop: 8 }}>
          <MoneyField id="fin_rate" label="예상 금리" unit="%" step="0.01" hint="기본 4.2%" placeholder="4.2" value={val('rate')} onChange={num('rate')} />
          {mode === 'buy' ? (
            <label className="f" htmlFor="fin_term"><span>만기</span>
              <select id="fin_term" value={n(f.term) || 30} onChange={(e) => set({ term: Number(e.target.value) })}>
                <option value={30}>30년</option><option value={40}>40년</option>
              </select>
              <div className="hint">수도권·규제지역은 30년까지만 인정돼요</div>
            </label>
          ) : (
            <MoneyField id="fin_moving" label="이사·기타 비용" unit="만원" hint="기본 300만원" placeholder="300" value={val('moving')} onChange={num('moving')} />
          )}
        </div>
        {mode === 'buy' && (
          <div className="grid2">
            <MoneyField id="fin_stress" label="스트레스 금리 (비우면 자동)" unit="%p" step="0.01" hint={`수도권·규제 ${params.stress.metro} / 지방 ${params.stress.local}`} value={val('stress')} onChange={num('stress')} />
            <MoneyField id="fin_moving" label="이사·기타 비용" unit="만원" hint="기본 300만원" placeholder="300" value={val('moving')} onChange={num('moving')} />
          </div>
        )}
      </Disclosure>

      {max && (
        <div className="card">
          <h3>최대 매수 가능 가격</h3>
          <table className="k"><tbody>
            <Row label="규제지역">{won(max.reg)}</Row>
            <Row label="비규제 수도권">{won(max.metro)}</Row>
            <Row label="지방">{won(max.local)}</Row>
          </tbody></table>
          <p className="hint">500만원 단위로 찾은 값이에요. 정책대출 조건을 충족하면 그 한도까지 포함했어요.</p>
        </div>
      )}
      <Disclaimer />
    </>
  );
}
