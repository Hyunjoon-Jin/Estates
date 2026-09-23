import { calcBuy, calcRent, n, won, type FinInput, type Params } from './finance';
import { avgScore, roleLabel } from './domain';
import type { Candidate, CandidateScore, Complex, Member, Visit } from './types';

/** 프로토타입 aiCompare 와 같은 형식으로 후보·임장·자금 계산을 텍스트로 묶는다. */
export function buildCompareContext(
  cands: Candidate[], complexes: Complex[], visits: Visit[], scores: CandidateScore[], members: Member[], f: FinInput, p: Params,
): string {
  const g = members.find((m) => m.role === 'groom');
  const b = members.find((m) => m.role === 'bride');
  const sc = (cid: string, m?: Member) => (m ? scores.find((s) => s.candidate_id === cid && s.user_id === m.user_id)?.score ?? 0 : 0);
  return cands
    .filter((c) => c.status !== '보류')
    .map((c) => {
      const cx = complexes.find((x) => x.id === c.complex_id);
      const r = n(c.price_manwon)
        ? c.deal_type === '전세'
          ? calcRent(c.price_manwon, cx?.region, f, p, cx?.reg_override)
          : calcBuy(c.price_manwon, cx?.region, f, p, cx?.reg_override)
        : null;
      const vs = visits
        .filter((v) => v.complex_id && v.complex_id === c.complex_id)
        .map((v) => {
          const by = members.find((m) => m.user_id === v.created_by);
          return `  - 임장(${v.date}, ${roleLabel(by?.role) || '?'}): 평균 ${avgScore(v).toFixed(1)}점, 출근 신랑 ${v.commute_groom ?? '?'}분/신부 ${v.commute_bride ?? '?'}분, 좋음: ${v.pros || '-'}, 아쉬움: ${v.cons || '-'}`;
        })
        .join('\n');
      return [
        `■ ${cx?.name ?? '?'} ${c.unit ?? ''} (${cx?.region || '지역미상'}${r?.reg ? ', 규제지역' : ''})`,
        `  ${c.deal_type} ${won(c.price_manwon)}, 면적 ${c.area || '?'}, 상태 ${c.status}`,
        `  선호도: 신랑 ${sc(c.id, g)}/5, 신부 ${sc(c.id, b)}/5`,
        r ? `  자금: 필요 현금 ${won(r.need)}, 가용 ${won(r.cash)}, ${r.gap >= 0 ? `여유 ${won(r.gap)}` : `부족 ${won(-r.gap)}`}, 대출 ${r.bestName} ${won(r.best)}, 월 상환 약 ${won(r.monthly)}` : '',
        `  메모: ${c.memo || '-'}`,
        `  단지 출퇴근 메모: ${cx?.commute || '-'}`,
        vs,
      ].filter(Boolean).join('\n');
    })
    .join('\n\n');
}
