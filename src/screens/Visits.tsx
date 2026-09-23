import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet } from '../components/Sheet';
import { StarsInput, StarsRO } from '../components/Stars';
import { useToast } from '../components/Toast';
import { today } from '../lib/date';
import { avgScore, memberName } from '../lib/domain';
import { errorMessage } from '../lib/errors';
import { n } from '../lib/finance';
import { sb } from '../lib/supabase';
import { RATE_KEYS, type RateKey, type Visit } from '../lib/types';
import { useApp } from '../state/AppData';

export function VisitCard({ v, onOpen }: { v: Visit; onOpen: () => void }) {
  const { complexes, members } = useApp();
  const cx = complexes.find((c) => c.id === v.complex_id);
  const by = members.find((m) => m.user_id === v.created_by);
  const rc = by?.role === 'groom' ? 'g' : by?.role === 'bride' ? 'b' : '';
  const avg = avgScore(v);
  return (
    <button type="button" className={`card link ${rc ? `stripe-${rc}` : ''}`} onClick={onOpen}>
      <div className="row between">
        <h3>{cx?.name ?? v.complex_name ?? '삭제된 단지'}</h3>
        <span className="small muted num">{v.date}</span>
      </div>
      <div className="row" style={{ gap: 8, marginTop: 2 }}>
        <span className={`tag ${rc}`}>{memberName(by)} 기록</span>
        {avg > 0 && <><StarsRO value={avg} /><span className="small muted num">{avg.toFixed(1)}</span></>}
      </div>
      {v.pros && <p className="small" style={{ marginTop: 6 }}>좋았던 점 · {v.pros}</p>}
      {v.cons && <p className="small">아쉬운 점 · {v.cons}</p>}
    </button>
  );
}

export function VisitEditor({ visit, onClose }: { visit?: Visit; onClose: () => void }) {
  const { complexes, household, members, uid, reload } = useApp();
  const toast = useToast();
  const [cx, setCx] = useState(visit?.complex_id ?? complexes[0]?.id ?? '');
  const [date, setDate] = useState(visit?.date ?? today());
  const [ratings, setRatings] = useState<Partial<Record<RateKey, number>>>(visit?.ratings ?? {});
  const [cg, setCg] = useState(visit?.commute_groom?.toString() ?? '');
  const [cb, setCb] = useState(visit?.commute_bride?.toString() ?? '');
  const [pros, setPros] = useState(visit?.pros ?? '');
  const [cons, setCons] = useState(visit?.cons ?? '');
  const [memo, setMemo] = useState(visit?.memo ?? '');
  const [busy, setBusy] = useState(false);
  const by = members.find((m) => m.user_id === visit?.created_by);
  const others = visit && visit.created_by !== uid;

  const save = async () => {
    if (!household) return;
    const c = complexes.find((x) => x.id === cx);
    const d = {
      household_id: household.id, complex_id: cx || null, complex_name: c?.name ?? null, date: date || today(), ratings,
      commute_groom: cg === '' ? null : Math.round(n(cg)), commute_bride: cb === '' ? null : Math.round(n(cb)),
      pros: pros.trim() || null, cons: cons.trim() || null, memo: memo.trim() || null,
    };
    setBusy(true);
    const { error } = visit ? await sb().from('visits').update(d).eq('id', visit.id) : await sb().from('visits').insert(d);
    setBusy(false);
    if (error) return toast(errorMessage(error));
    toast('임장 기록을 저장했어요');
    void reload('visits');
    onClose();
  };

  const del = async () => {
    if (!visit || !confirm('이 임장 기록을 지울까요?')) return;
    const { error } = await sb().from('visits').delete().eq('id', visit.id);
    if (error) return toast(errorMessage(error));
    toast('기록을 지웠어요');
    void reload('visits');
    onClose();
  };

  return (
    <Sheet
      title={visit ? '임장 기록' : '임장 기록하기'}
      onClose={onClose}
      footer={<>
        {visit ? <button type="button" className="btn ghost danger" onClick={del}>기록 삭제</button> : <span />}
        <button type="button" className="btn key" onClick={save} disabled={busy}>저장</button>
      </>}
    >
      {others && <p className="small"><span className={`tag ${by?.role === 'groom' ? 'g' : 'b'}`}>{memberName(by)}</span> 님이 남긴 기록이에요. 같이 고칠 수 있어요.</p>}
      <label className="f" htmlFor="vCx"><span>단지</span>
        <select id="vCx" value={cx} onChange={(e) => setCx(e.target.value)}>
          {complexes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="f" htmlFor="vDate"><span>다녀온 날</span>
        <input id="vDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="card" style={{ background: 'var(--soft)' }}>
        {RATE_KEYS.map(([k, label]) => (
          <div key={k} className="row between" style={{ margin: '2px 0' }}>
            <span>{label}</span>
            <StarsInput label={label} value={n(ratings[k])} onChange={(v) => setRatings((r) => ({ ...r, [k]: v }))} />
          </div>
        ))}
      </div>
      <div className="grid2">
        <label className="f" htmlFor="vCg"><span>신랑 출근 시간</span><div className="unit"><input id="vCg" type="number" inputMode="numeric" min="0" max="600" value={cg} onChange={(e) => setCg(e.target.value)} /><em>분</em></div></label>
        <label className="f" htmlFor="vCb"><span>신부 출근 시간</span><div className="unit"><input id="vCb" type="number" inputMode="numeric" min="0" max="600" value={cb} onChange={(e) => setCb(e.target.value)} /><em>분</em></div></label>
      </div>
      <label className="f" htmlFor="vPros"><span>좋았던 점</span><input id="vPros" type="text" maxLength={120} value={pros} onChange={(e) => setPros(e.target.value)} /></label>
      <label className="f" htmlFor="vCons"><span>아쉬운 점</span><input id="vCons" type="text" maxLength={120} value={cons} onChange={(e) => setCons(e.target.value)} /></label>
      <label className="f" htmlFor="vMemo"><span>메모 (중개사, 동·호, 관리비 등)</span><textarea id="vMemo" maxLength={1000} value={memo} onChange={(e) => setMemo(e.target.value)} /></label>
    </Sheet>
  );
}

/** 단지가 없으면 시세 탭으로 안내 */
export function useVisitEditor() {
  const { complexes } = useApp();
  const toast = useToast();
  const nav = useNavigate();
  const [open, setOpen] = useState<{ v?: Visit } | null>(null);
  const start = (v?: Visit) => {
    if (!complexes.length) {
      toast('시세 탭에서 단지를 먼저 추가해주세요');
      nav('/price');
      return;
    }
    setOpen({ v });
  };
  const el = open ? <VisitEditor visit={open.v} onClose={() => setOpen(null)} /> : null;
  return { start, el };
}

export function Visits() {
  const { visits } = useApp();
  const ed = useVisitEditor();
  return (
    <>
      <div className="sec" style={{ marginTop: 4 }}>
        <h2>임장 기록</h2>
        <button type="button" className="btn key sm" onClick={() => ed.start()}>임장 기록하기</button>
      </div>
      <p className="small muted" style={{ marginTop: -4 }}>
        카드 왼쪽 띠 색이 기록한 사람이에요. <span style={{ color: 'var(--groom)', fontWeight: 600 }}>파랑</span>은 신랑, <span style={{ color: 'var(--bride)', fontWeight: 600 }}>분홍</span>은 신부예요.
      </p>
      {visits.length ? visits.map((v) => <VisitCard key={v.id} v={v} onOpen={() => ed.start(v)} />) : (
        <div className="empty"><p>다녀온 단지의 교통, 소음, 채광을 별점으로 남겨두면<br />후보를 고를 때 둘의 기억을 맞춰볼 수 있어요.</p></div>
      )}
      {ed.el}
    </>
  );
}
