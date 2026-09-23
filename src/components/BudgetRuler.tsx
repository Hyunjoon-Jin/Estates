import { Link } from 'react-router-dom';
import { finBase, maxAffordAll, wonS } from '../lib/finance';
import { useMemo } from 'react';
import { useApp } from '../state/AppData';
import { Disclaimer } from './Disclaimer';

/** 홈의 예산 눈금자: 규제지역·비규제 수도권 최대 매수가 + 매매 후보 위치 */
export function BudgetRuler() {
  const { fin, params, candidates, complexes } = useApp();
  const base = finBase(fin);
  const has = base.inc > 0 || base.cash > 0;
  const max = useMemo(() => (has ? maxAffordAll(fin, params) : null), [has, fin, params]);

  if (!has || !max) {
    return (
      <div className="empty">
        <p>자금 탭에 두 사람의 소득과 가용자산을 넣으면<br />살 수 있는 가격대가 여기에 그려져요.</p>
        <Link className="btn key" to="/money" style={{ marginTop: 8 }}>자금 입력하기</Link>
      </div>
    );
  }

  const items = candidates
    .filter((c) => c.deal_type !== '전세' && (c.price_manwon ?? 0) > 0 && c.status !== '보류')
    .map((c) => ({ id: c.id, label: complexes.find((x) => x.id === c.complex_id)?.name ?? '후보', price: c.price_manwon! }));
  const top = Math.max(max.reg, max.metro, ...items.map((i) => i.price), 50000) * 1.15;
  const pct = (v: number) => Math.min(100, (v / top) * 100);
  const lo = Math.min(max.reg, max.metro);
  const hi = Math.max(max.reg, max.metro);

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <h3>얼마까지 살 수 있을까</h3>
      <p className="small muted">지금 입력한 자산·소득 기준으로 필요한 현금이 가용자산 안에 들어오는 최대 매매가예요.</p>
      <div className="ruler" role="img" aria-label={`규제지역 최대 ${wonS(max.reg)}, 비규제 수도권 최대 ${wonS(max.metro)}. 매매 후보 ${items.map((i) => `${i.label} ${wonS(i.price)}`).join(', ') || '없음'}`}>
        <div className="track" />
        <div className="zone z2" style={{ left: 0, width: `${pct(hi)}%` }} />
        <div className="zone z1" style={{ left: 0, width: `${pct(lo)}%` }} />
        {items.slice(0, 8).map((i) => (
          <div key={i.id} className="tick" style={{ left: `${pct(i.price)}%` }}>
            <i style={{ transform: `translateX(${pct(i.price) < 12 ? -10 : pct(i.price) > 88 ? -90 : -50}%)` }}>{i.label.slice(0, 6)}</i>
          </div>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((k) => (
          <span key={k} className="axis num" style={{ left: `${k * 100}%`, transform: k === 0 ? 'none' : k === 1 ? 'translateX(-100%)' : undefined }}>{wonS(Math.round((top * k) / 1000) * 1000)}</span>
        ))}
      </div>
      <div className="legend" style={{ marginTop: 6 }}>
        <span><i style={{ background: 'color-mix(in srgb,var(--ok) 55%,transparent)' }} />규제지역 {wonS(max.reg)}까지</span>
        <span><i style={{ background: 'color-mix(in srgb,var(--ok) 22%,transparent)' }} />비규제 수도권 {wonS(max.metro)}까지</span>
        <span>세로선: 매매 후보</span>
      </div>
      <Disclaimer />
    </div>
  );
}
