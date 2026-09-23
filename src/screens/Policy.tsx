import { isReg } from '../lib/finance';
import { useApp } from '../state/AppData';

const OFFICIAL: [string, string, string][] = [
  ['https://enhuf.molit.go.kr/', '주택도시기금 기금e든든', '디딤돌·버팀목 자격 확인'],
  ['https://www.hf.go.kr/', '한국주택금융공사', '보금자리론, 디딤돌 금리'],
  ['https://www.fsc.go.kr/', '금융위원회', '대출 규제 변경'],
  ['https://www.molit.go.kr/', '국토교통부', '규제지역 지정·해제'],
];

export function Policy() {
  const { policy, complexes, params } = useApp();
  return (
    <>
      <div className="sec" style={{ marginTop: 4 }}>
        <h2>부동산 정책</h2>
        {policy?.updated_at && <span className="small muted num">{policy.updated_at} 기준</span>}
      </div>
      {policy?.headline && <p>{policy.headline}</p>}
      {complexes.length > 0 && (
        <div className="card">
          <h3>우리 관심 단지의 규제 여부</h3>
          {complexes.map((c) => (
            <div key={c.id} className="row-line">
              <span>{c.name} <span className="small muted">{c.region || '지역 미지정'}{c.reg_override ? ' · 직접 지정' : ''}</span></span>
              {isReg(c.region, c.reg_override, params) ? <span className="tag reg">규제지역</span> : <span className="tag">비규제</span>}
            </div>
          ))}
          <p className="hint">규제지역이면 LTV {params.ltv.reg}%(생애최초 {params.ltv.regFirst}%), 토지거래허가 대상이면 실거주 의무가 붙어요.</p>
        </div>
      )}
      {policy && Array.isArray(policy.items) ? policy.items.map((it, i) => (
        <article key={`${it.title}-${i}`} className="card policy">
          <div className="row" style={{ gap: 6, marginBottom: 4 }}>
            {it.tag && <span className="tag">{it.tag}</span>}
            {it.date && <span className="small muted num">{it.date}</span>}
          </div>
          <h3>{it.title}</h3>
          {it.summary && <p className="small">{it.summary}</p>}
          {it.impact && <div className="impact"><b>우리에게</b> · {it.impact}</div>}
          {it.url && <p className="small" style={{ marginTop: 6 }}><a href={it.url} target="_blank" rel="noopener noreferrer">{it.source || '원문 보기'}</a></p>}
        </article>
      )) : <div className="empty">정책 요약을 아직 불러오지 못했어요. 잠시 뒤 새로고침해주세요.</div>}
      <div className="card">
        <h3>공식 창구</h3>
        <p className="small">
          {OFFICIAL.map(([href, name, what]) => (
            <span key={href}><a href={href} target="_blank" rel="noopener noreferrer">{name}</a> · {what}<br /></span>
          ))}
        </p>
        <p className="hint">여기 요약은 참고용이에요. 정책은 바뀔 수 있으니 날짜를 확인하고, 계약 전에는 은행 사전심사와 기금e든든 자격 조회로 꼭 다시 확인하세요.</p>
      </div>
    </>
  );
}
