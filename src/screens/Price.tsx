import { useState } from 'react';
import { RegionSelect } from '../components/RegionSelect';
import { Sheet } from '../components/Sheet';
import { Sparkline } from '../components/Sparkline';
import { useToast } from '../components/Toast';
import { today } from '../lib/date';
import { latestPrice, memberName, pricesOf } from '../lib/domain';
import { errorMessage } from '../lib/errors';
import { isReg, n, won } from '../lib/finance';
import { sb } from '../lib/supabase';
import { PRICE_TYPES, type Complex, type PriceType } from '../lib/types';
import { useApp } from '../state/AppData';

export function ComplexEditor({ complex, onClose }: { complex?: Complex; onClose: () => void }) {
  const { household, params, reload } = useApp();
  const toast = useToast();
  const [f, setF] = useState({
    name: complex?.name ?? '', region: complex?.region ?? '', reg_override: complex?.reg_override ?? '',
    area: complex?.area ?? '', meta: complex?.meta ?? '', commute: complex?.commute ?? '', memo: complex?.memo ?? '',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    if (!household) return;
    if (!f.name.trim()) return setErr('단지 이름을 입력해주세요.');
    const d = {
      household_id: household.id, name: f.name.trim(), region: f.region || null, reg_override: f.reg_override || null,
      area: f.area.trim() || null, meta: f.meta.trim() || null, commute: f.commute.trim() || null, memo: f.memo.trim() || null,
    };
    setBusy(true);
    const { error } = complex ? await sb().from('complexes').update(d).eq('id', complex.id) : await sb().from('complexes').insert(d);
    setBusy(false);
    if (error) return setErr(errorMessage(error));
    toast(complex ? '단지를 수정했어요' : '단지를 추가했어요');
    void reload('complexes');
    onClose();
  };

  const del = async () => {
    if (!complex || !confirm('이 단지와 시세 기록을 지울까요? 연결된 임장·후보 기록은 남아요.')) return;
    const { error } = await sb().from('complexes').delete().eq('id', complex.id);
    if (error) return toast(errorMessage(error));
    toast('단지를 삭제했어요');
    void reload();
    onClose();
  };

  return (
    <Sheet title={complex ? '단지 수정' : '단지 추가'} onClose={onClose} footer={<>
      {complex ? <button type="button" className="btn ghost danger" onClick={del}>단지 삭제</button> : <span />}
      <button type="button" className="btn key" onClick={save} disabled={busy}>저장</button>
    </>}>
      <label className="f" htmlFor="cxName"><span>단지 이름</span>
        <input id="cxName" type="text" maxLength={40} value={f.name} onChange={(e) => set('name')(e.target.value)} placeholder="예: 동천 래미안 이스트팰리스" />
      </label>
      <label className="f" htmlFor="cxRegion"><span>지역</span><RegionSelect id="cxRegion" value={f.region} onChange={set('region')} params={params} /></label>
      <label className="f" htmlFor="cxOv"><span>규제지역 여부</span>
        <select id="cxOv" value={f.reg_override} onChange={(e) => set('reg_override')(e.target.value)}>
          <option value="">자동 판단</option>
          <option value="yes">규제지역으로 계산</option>
          <option value="no">비규제로 계산</option>
        </select>
        <div className="hint">지정이 바뀌었는데 정책 목록이 아직 안 바뀌었을 때만 직접 고르세요.</div>
      </label>
      <div className="grid2">
        <label className="f" htmlFor="cxArea"><span>관심 평형</span><input id="cxArea" type="text" maxLength={20} value={f.area} onChange={(e) => set('area')(e.target.value)} placeholder="예: 84㎡" /></label>
        <label className="f" htmlFor="cxMeta"><span>세대수·연식</span><input id="cxMeta" type="text" maxLength={30} value={f.meta} onChange={(e) => set('meta')(e.target.value)} placeholder="예: 1,200세대 · 2010년" /></label>
      </div>
      <label className="f" htmlFor="cxCommute"><span>출퇴근 메모</span><input id="cxCommute" type="text" maxLength={80} value={f.commute} onChange={(e) => set('commute')(e.target.value)} placeholder="예: 신랑 분당 25분 / 신부 수원 40분" /></label>
      <label className="f" htmlFor="cxMemo"><span>메모</span><textarea id="cxMemo" maxLength={600} value={f.memo} onChange={(e) => set('memo')(e.target.value)} /></label>
      {err && <p className="err" role="alert">{err}</p>}
    </Sheet>
  );
}

function ComplexDetail({ complex, onClose, onEdit }: { complex: Complex; onClose: () => void; onEdit: () => void }) {
  const { prices, household, members, params, reload } = useApp();
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [type, setType] = useState<PriceType>('실거래');
  const [price, setPrice] = useState('');
  const [floor, setFloor] = useState('');
  const [busy, setBusy] = useState(false);
  const ps = pricesOf(complex.id, prices).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const q = encodeURIComponent(complex.name);

  const add = async () => {
    const pr = Math.round(n(price));
    if (!(pr > 0)) return toast('가격을 만원 단위 숫자로 입력해주세요. 예: 85000');
    if (!household) return;
    setBusy(true);
    const { error } = await sb().from('price_records').insert({
      household_id: household.id, complex_id: complex.id, date: date || today(), type, price_manwon: pr, floor: floor.trim() || null,
    });
    setBusy(false);
    if (error) return toast(errorMessage(error));
    setPrice('');
    setFloor('');
    toast('시세를 기록했어요');
    void reload('price_records');
  };

  const del = async (id: string) => {
    const { error } = await sb().from('price_records').delete().eq('id', id);
    if (error) return toast(errorMessage(error));
    toast('기록을 지웠어요');
    void reload('price_records');
  };

  return (
    <Sheet title={complex.name} onClose={onClose} footer={<>
      <button type="button" className="btn ghost" onClick={onEdit}>단지 정보 수정</button><span />
    </>}>
      <div className="row" style={{ gap: 6, marginBottom: 8 }}>
        {complex.region && <span className="tag">{complex.region}</span>}
        {isReg(complex.region, complex.reg_override, params) && <span className="tag reg">규제지역</span>}
        {complex.area && <span className="tag">{complex.area}</span>}
        {complex.meta && <span className="tag">{complex.meta}</span>}
      </div>
      {complex.commute && <p className="small">출퇴근 · {complex.commute}</p>}
      {complex.memo && <p className="small muted" style={{ whiteSpace: 'pre-wrap' }}>{complex.memo}</p>}
      <div className="row" style={{ margin: '10px 0', gap: 6 }}>
        <a className="btn sm" target="_blank" rel="noopener noreferrer" href={`https://m.land.naver.com/search/result/${q}`}>네이버부동산</a>
        <a className="btn sm" target="_blank" rel="noopener noreferrer" href={`https://hogangnono.com/search?q=${q}`}>호갱노노</a>
        <a className="btn sm" target="_blank" rel="noopener noreferrer" href="https://rt.molit.go.kr/">국토부 실거래가</a>
        <a className="btn sm" target="_blank" rel="noopener noreferrer" href="https://kbland.kr/">KB부동산</a>
      </div>
      <Sparkline prices={ps} />
      <h3 style={{ margin: '14px 0 6px' }}>시세 기록 추가</h3>
      <div className="grid2">
        <label className="f" htmlFor="pDate"><span>날짜</span><input id="pDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="f" htmlFor="pType"><span>구분</span>
          <select id="pType" value={type} onChange={(e) => setType(e.target.value as PriceType)}>{PRICE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        </label>
        <label className="f" htmlFor="pPrice"><span>가격</span><div className="unit"><input id="pPrice" type="number" inputMode="numeric" min="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="85000" /><em>만원</em></div>
          {n(price) > 0 && <div className="hint num">{won(price)}</div>}
        </label>
        <label className="f" htmlFor="pFloor"><span>층·평형</span><input id="pFloor" type="text" maxLength={20} value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="12층 84㎡" /></label>
      </div>
      <button type="button" className="btn key sm" onClick={add} disabled={busy}>기록 추가</button>
      <h3 style={{ margin: '16px 0 6px' }}>기록 {ps.length}건</h3>
      {ps.length ? (
        <table className="k"><tbody>
          {ps.map((p) => (
            <tr key={p.id}>
              <td>{p.date} <span className="tag">{p.type}</span>
                <div className="small muted">{[p.floor, p.created_by ? memberName(members.find((m) => m.user_id === p.created_by)) : ''].filter(Boolean).join(' · ')}</div>
              </td>
              <td><b className="num">{won(p.price_manwon)}</b><br />
                <button type="button" className="iconbtn small" onClick={() => del(p.id)} aria-label={`${p.date} ${p.type} ${won(p.price_manwon)} 기록 삭제`}>삭제</button>
              </td>
            </tr>
          ))}
        </tbody></table>
      ) : <p className="small muted">아직 기록이 없어요.</p>}
    </Sheet>
  );
}

export function Price() {
  const { complexes, prices, visits, params } = useApp();
  const [edit, setEdit] = useState<{ c?: Complex } | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const cur = complexes.find((c) => c.id === detail);

  return (
    <>
      <div className="sec" style={{ marginTop: 4 }}>
        <h2>관심 단지 시세</h2>
        <button type="button" className="btn key sm" onClick={() => setEdit({})}>단지 추가</button>
      </div>
      <p className="small muted" style={{ marginTop: -4 }}>실거래가·호가·KB시세를 직접 기록해두면 흐름이 그래프로 쌓여요. 단지를 누르면 시세 사이트로 바로 갈 수 있어요.</p>
      {complexes.length ? complexes.map((c) => {
        const lp = latestPrice(c.id, prices);
        const vc = visits.filter((v) => v.complex_id === c.id).length;
        return (
          <button key={c.id} type="button" className="card link" onClick={() => setDetail(c.id)}>
            <div className="row between">
              <div className="grow">
                <h3>{c.name}</h3>
                <div className="row" style={{ gap: 6, marginTop: 3 }}>
                  <span className="tag">{c.region || '지역 미지정'}</span>
                  {isReg(c.region, c.reg_override, params) && <span className="tag reg">규제지역</span>}
                  {vc > 0 && <span className="tag">임장 {vc}회</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {lp ? <><b className="num">{won(lp.price_manwon)}</b><div className="small muted">{lp.type} · {lp.date}</div></> : <span className="small muted">시세 기록 없음</span>}
              </div>
            </div>
            <Sparkline prices={pricesOf(c.id, prices)} />
          </button>
        );
      }) : <div className="empty"><p>보고 있는 아파트 단지를 추가해보세요.</p></div>}
      {edit && <ComplexEditor complex={edit.c} onClose={() => setEdit(null)} />}
      {cur && !edit && <ComplexDetail complex={cur} onClose={() => setDetail(null)} onEdit={() => setEdit({ c: cur })} />}
    </>
  );
}
