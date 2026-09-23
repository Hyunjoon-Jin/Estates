import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Disclaimer } from '../components/Disclaimer';
import { Sheet } from '../components/Sheet';
import { StarsInput, StarsRO } from '../components/Stars';
import { useToast } from '../components/Toast';
import { buildCompareContext } from '../lib/aiCompare';
import { dealVerdict } from '../lib/domain';
import { errorMessage } from '../lib/errors';
import { n, won, wonS } from '../lib/finance';
import { sb } from '../lib/supabase';
import { STATUSES, type Candidate, type Member, type Status } from '../lib/types';
import { useApp } from '../state/AppData';

function CandEditor({ cand, onClose }: { cand?: Candidate; onClose: () => void }) {
  const { complexes, household, reload } = useApp();
  const toast = useToast();
  const [f, setF] = useState({
    complex_id: cand?.complex_id ?? complexes[0]?.id ?? '', deal_type: cand?.deal_type ?? '매매', status: cand?.status ?? '관심',
    unit: cand?.unit ?? '', area: cand?.area ?? '', price: cand?.price_manwon?.toString() ?? '', memo: cand?.memo ?? '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    if (!household) return;
    const d = {
      household_id: household.id, complex_id: f.complex_id || null, deal_type: f.deal_type, status: f.status,
      unit: f.unit.trim() || null, area: f.area.trim() || null, price_manwon: f.price === '' ? null : Math.round(n(f.price)), memo: f.memo.trim() || null,
    };
    setBusy(true);
    const { error } = cand ? await sb().from('candidates').update(d).eq('id', cand.id) : await sb().from('candidates').insert(d);
    setBusy(false);
    if (error) return toast(errorMessage(error));
    toast(cand ? '후보를 수정했어요' : '후보를 추가했어요');
    void reload('candidates');
    onClose();
  };
  const del = async () => {
    if (!cand || !confirm('이 후보를 지울까요?')) return;
    const { error } = await sb().from('candidates').delete().eq('id', cand.id);
    if (error) return toast(errorMessage(error));
    toast('후보를 지웠어요');
    void reload('candidates');
    onClose();
  };

  return (
    <Sheet title={cand ? '후보 수정' : '후보 추가'} onClose={onClose} footer={<>
      {cand ? <button type="button" className="btn ghost danger" onClick={del}>후보 삭제</button> : <span />}
      <button type="button" className="btn key" onClick={save} disabled={busy}>저장</button>
    </>}>
      <label className="f" htmlFor="cCx"><span>단지</span>
        <select id="cCx" value={f.complex_id} onChange={(e) => set('complex_id')(e.target.value)}>
          {complexes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <div className="grid2">
        <label className="f" htmlFor="cType"><span>거래</span>
          <select id="cType" value={f.deal_type} onChange={(e) => set('deal_type')(e.target.value)}><option>매매</option><option>전세</option></select>
        </label>
        <label className="f" htmlFor="cStatus"><span>상태</span>
          <select id="cStatus" value={f.status} onChange={(e) => set('status')(e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        </label>
        <label className="f" htmlFor="cUnit"><span>동·호</span><input id="cUnit" type="text" maxLength={20} value={f.unit} onChange={(e) => set('unit')(e.target.value)} placeholder="105동 1203호" /></label>
        <label className="f" htmlFor="cArea"><span>면적</span><input id="cArea" type="text" maxLength={20} value={f.area} onChange={(e) => set('area')(e.target.value)} placeholder="84㎡" /></label>
      </div>
      <label className="f" htmlFor="cPrice"><span>가격 (매매가 또는 보증금)</span>
        <div className="unit"><input id="cPrice" type="number" inputMode="numeric" min="0" value={f.price} onChange={(e) => set('price')(e.target.value)} placeholder="85000" /><em>만원</em></div>
        {n(f.price) > 0 && <div className="hint num">{won(f.price)}</div>}
      </label>
      <label className="f" htmlFor="cMemo"><span>메모 (중개사 연락처, 입주 가능일, 옵션 등)</span><textarea id="cMemo" maxLength={1000} value={f.memo} onChange={(e) => set('memo')(e.target.value)} /></label>
    </Sheet>
  );
}

function AiCompare({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'run' | 'done'>('idle');
  const ctl = useRef<AbortController | null>(null);

  const run = async () => {
    const context = buildCompareContext(app.candidates, app.complexes, app.visits, app.scores, app.members, app.fin, app.params);
    ctl.current = new AbortController();
    setState('run');
    setText('생각하는 중…');
    try {
      const { data } = await sb().auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-compare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session?.access_token ?? ''}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
        },
        body: JSON.stringify({ context }),
        signal: ctl.current.signal,
      });
      if (!res.ok || !res.body) {
        const msg = res.status === 429 ? '요청이 많아요. 잠시 뒤 다시 시도해주세요.' : res.status === 503 ? 'AI 정리 기능이 아직 설정되지 않았어요. README의 Edge Function 설정을 확인해주세요.' : '정리하지 못했어요. 잠시 뒤 다시 시도해주세요.';
        setText(msg);
        setState('done');
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setText(acc);
      }
      setState('done');
    } catch (e) {
      if ((e as Error).name === 'AbortError') setText((t) => `${t === '생각하는 중…' ? '' : t}\n\n(멈췄어요)`);
      else setText('네트워크에 연결하지 못했어요. 연결을 확인하고 다시 시도해주세요.');
      setState('done');
    }
  };

  const close = () => {
    ctl.current?.abort();
    onClose();
  };

  return (
    <Sheet title="후보 비교 정리" onClose={close} footer={<>
      {state === 'run' ? <button type="button" className="btn sm" onClick={() => ctl.current?.abort()}>멈추기</button> : <span />}
      {state !== 'run' && <button type="button" className="btn key" onClick={run}>{state === 'done' ? '다시 정리받기' : '비교 정리 받기'}</button>}
    </>}>
      {state === 'idle' ? (
        <p className="small muted">보류를 뺀 후보와 임장 기록, 자금 계산 결과를 Claude에게 보내 장단점을 정리받아요. 이름·이메일은 보내지 않아요.</p>
      ) : (
        <div className="ai-out" aria-live="polite">{text}</div>
      )}
      <Disclaimer />
    </Sheet>
  );
}

function ScoreRow({ c, m, label, cls, mine }: { c: Candidate; m?: Member; label: string; cls: string; mine: boolean }) {
  const { scores, uid, reload } = useApp();
  const toast = useToast();
  const v = m ? scores.find((s) => s.candidate_id === c.id && s.user_id === m.user_id)?.score ?? 0 : 0;
  const setScore = async (nv: number) => {
    const { error } = await sb().from('candidate_scores').upsert({ candidate_id: c.id, user_id: uid, score: nv });
    if (error) return toast(errorMessage(error));
    void reload('candidate_scores');
  };
  return (
    <div className="small">
      <span style={{ color: `var(--${cls})`, fontWeight: 600 }}>{label}</span>{' '}
      {mine ? <StarsInput label={`내 선호 (${label})`} value={v} onChange={setScore} /> : <StarsRO value={v} />}
    </div>
  );
}

export function Candidates() {
  const { candidates, complexes, members, uid, fin, params, reload } = useApp();
  const toast = useToast();
  const nav = useNavigate();
  const [filter, setFilter] = useState<'전체' | Status>('전체');
  const [edit, setEdit] = useState<{ c?: Candidate } | null>(null);
  const [ai, setAi] = useState(false);
  const list = candidates.filter((c) => filter === '전체' || c.status === filter);
  const g = members.find((m) => m.role === 'groom');
  const b = members.find((m) => m.role === 'bride');

  const add = () => {
    if (!complexes.length) {
      toast('시세 탭에서 단지를 먼저 추가해주세요');
      nav('/price');
      return;
    }
    setEdit({});
  };
  const setStatus = async (c: Candidate, s: string) => {
    const { error } = await sb().from('candidates').update({ status: s }).eq('id', c.id);
    if (error) return toast(errorMessage(error));
    toast('상태를 바꿨어요');
    void reload('candidates');
  };

  return (
    <>
      <div className="sec" style={{ marginTop: 4 }}>
        <h2>계약 후보</h2>
        <button type="button" className="btn key sm" onClick={add}>후보 추가</button>
      </div>
      <div className="chips" role="group" aria-label="상태 필터">
        {(['전체', ...STATUSES] as const).map((s) => (
          <button key={s} type="button" className="chip" aria-pressed={filter === s} onClick={() => setFilter(s)}>{s}</button>
        ))}
      </div>
      {list.length ? list.map((c) => {
        const cx = complexes.find((x) => x.id === c.complex_id);
        const r = dealVerdict(c.price_manwon, c.deal_type, cx, fin, params);
        return (
          <div key={c.id} className="card">
            <div className="row between">
              <div className="grow">
                <h3>{cx?.name ?? '삭제된 단지'} <span className="small muted">{c.unit}</span></h3>
                <div className="row" style={{ gap: 6, marginTop: 3 }}>
                  <span className="tag">{c.deal_type}</span>
                  {c.area && <span className="tag">{c.area}</span>}
                  {r && (r.gap >= 0
                    ? <span className="tag ok">자금 가능 · 여유 {wonS(r.gap)}</span>
                    : <span className="tag bad">{wonS(-r.gap)} 부족</span>)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}><b className="num" style={{ fontSize: '1.1rem' }}>{n(c.price_manwon) ? won(c.price_manwon) : '-'}</b></div>
            </div>
            <div className="row between" style={{ marginTop: 8 }}>
              <ScoreRow c={c} m={g} label="신랑" cls="groom" mine={!!g && g.user_id === uid} />
              <ScoreRow c={c} m={b} label="신부" cls="bride" mine={!!b && b.user_id === uid} />
            </div>
            {c.memo && <p className="small muted" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{c.memo}</p>}
            <div className="row between" style={{ marginTop: 8 }}>
              <select aria-label={`${cx?.name ?? '후보'} 진행 상태`} value={c.status} onChange={(e) => setStatus(c, e.target.value)} style={{ width: 'auto', minHeight: 34, padding: '4px 8px' }}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <button type="button" className="btn sm ghost" onClick={() => setEdit({ c })} aria-label={`${cx?.name ?? '후보'} 수정`}>수정</button>
            </div>
          </div>
        );
      }) : (
        <div className="empty"><p>{candidates.length ? '이 상태의 후보가 없어요.' : '마음에 드는 매물을 후보로 올리면 자금 가능 여부가 자동으로 붙어요.'}</p></div>
      )}
      {candidates.some((c) => c.price_manwon) && <Disclaimer />}
      {candidates.length >= 2 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>후보 비교 정리</h3>
          <p className="small muted">후보·임장 기록·자금 계산을 Claude에게 보내 장단점을 정리받아요.</p>
          <button type="button" className="btn" onClick={() => setAi(true)}>비교 정리 받기</button>
        </div>
      )}
      {edit && <CandEditor cand={edit.c} onClose={() => setEdit(null)} />}
      {ai && <AiCompare onClose={() => setAi(false)} />}
    </>
  );
}
