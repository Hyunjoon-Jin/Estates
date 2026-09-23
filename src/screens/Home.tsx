import { Link } from 'react-router-dom';
import { BudgetRuler } from '../components/BudgetRuler';
import { HouseHeader } from '../components/HouseHeader';
import { useApp } from '../state/AppData';
import { useVisitEditor, VisitCard } from './Visits';

export function Home() {
  const { complexes, visits, candidates } = useApp();
  const ed = useVisitEditor();
  const stats: [string, number, string][] = [
    ['/price', complexes.length, '관심 단지'],
    ['/visit', visits.length, '임장 기록'],
    ['/cand', candidates.filter((c) => c.status !== '보류').length, '계약 후보'],
  ];
  return (
    <>
      <HouseHeader />
      <div className="stats">
        {stats.map(([to, v, label]) => (
          <Link key={to} className="stat" to={to} aria-label={`${label} ${v}개, 보러 가기`} style={{ textDecoration: 'none' }}>
            <b className="num">{v}</b><span>{label}</span>
          </Link>
        ))}
      </div>
      <div className="sec"><h2>예산</h2></div>
      <BudgetRuler />
      <div className="sec"><h2>최근 임장</h2><Link className="btn sm ghost" to="/visit">전체 보기</Link></div>
      {visits.length ? visits.slice(0, 3).map((v) => <VisitCard key={v.id} v={v} onOpen={() => ed.start(v)} />) : <div className="empty">아직 임장 기록이 없어요.</div>}
      {ed.el}
    </>
  );
}
