import { Link } from 'react-router-dom';
import { finBase } from '../lib/finance';
import { useApp } from '../state/AppData';

/** 처음 쓰는 두 사람에게 다음 할 일을 순서대로 보여준다. 다 하면 사라진다. */
export function SetupChecklist() {
  const { members, fin, complexes, visits, household } = useApp();
  const b = finBase(fin);
  const steps: { done: boolean; label: string; to: string; cta: string }[] = [
    { done: members.length >= 2, label: '짝꿍 초대하기', to: '/settings', cta: '위 초대코드를 보내주세요' },
    { done: b.inc > 0 && b.cash > 0, label: '소득과 가용자산 넣기', to: '/money', cta: '자금 입력' },
    { done: complexes.length > 0, label: '관심 단지 추가하기', to: '/price', cta: '단지 추가' },
    { done: visits.length > 0, label: '첫 임장 기록 남기기', to: '/visit', cta: '기록하기' },
    { done: !!household?.move_in, label: '입주 목표 월 정하기', to: '/settings', cta: '설정' },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  const next = steps.find((s) => !s.done)!;
  return (
    <section className="card checklist" aria-labelledby="h-setup">
      <div className="row between">
        <h3 id="h-setup">시작하기</h3>
        <span className="small muted num">{doneCount}/{steps.length}</span>
      </div>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount} aria-label="시작하기 진행">
        <i style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ol>
        {steps.map((s) => (
          <li key={s.label} className={s.done ? 'done' : s === next ? 'next' : ''}>
            <span className="dot" aria-hidden="true">{s.done ? '✓' : ''}</span>
            <span className="grow">{s.label}<span className="sr-only">{s.done ? ' (완료)' : ''}</span></span>
            {s === next && s.to && (s.label === '짝꿍 초대하기' ? <span className="small muted">{s.cta}</span> : <Link className="btn key sm" to={s.to}>{s.cta}</Link>)}
          </li>
        ))}
      </ol>
    </section>
  );
}
