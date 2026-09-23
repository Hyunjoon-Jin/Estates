import { Link } from 'react-router-dom';
import { ddays } from '../lib/date';
import { memberName } from '../lib/domain';
import type { Member } from '../lib/types';
import { useApp } from '../state/AppData';
import { useToast } from './Toast';

function Slot({ m, cls, label }: { m?: Member; cls: string; label: string }) {
  return (
    <span className={`who ${cls}`}>
      <span>
        <small style={{ fontSize: '.8rem', display: 'block', fontFamily: "'IBM Plex Sans KR'" }}>{label}</small>
        {m ? <span className="nm">{memberName(m)}</span> : <span className="nm" style={{ opacity: 0.55 }}>초대 대기</span>}
      </span>
    </span>
  );
}

export function HouseHeader() {
  const { household, members } = useApp();
  const toast = useToast();
  if (!household) return null;
  const g = members.find((m) => m.role === 'groom');
  const b = members.find((m) => m.role === 'bride');
  const alone = members.length < 2;
  const dd = household.move_in ? ddays(household.move_in) : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(household.invite_code);
      toast('코드를 복사했어요');
    } catch {
      toast(`코드: ${household.invite_code}`);
    }
  };

  return (
    <header className="house">
      <div className="roof" aria-hidden="true" />
      <div className="couple">
        <Slot m={g} cls="g" label="신랑" />
        <span className="amp" aria-hidden="true">＆</span>
        <Slot m={b} cls="b" label="신부" />
      </div>
      {household.move_in && dd != null && (
        <div className="dday">
          입주 목표 {household.move_in.replace('-', '년 ')}월 · <b className="num">{dd >= 0 ? `D-${dd}` : `D+${-dd}`}</b>
        </div>
      )}
      {alone && (
        <div className="invite">
          <div className="small" style={{ color: '#C8D1D8' }}>
            짝꿍에게 이 코드를 보내주세요. 로그인한 뒤 ‘초대코드로 합류’에 입력하면 돼요.
          </div>
          <div className="row between">
            <span className="code" aria-label={`초대코드 ${household.invite_code.split('').join(' ')}`}>{household.invite_code}</span>
            <button type="button" className="btn sm" onClick={copy} aria-label="초대코드 복사">코드 복사</button>
          </div>
        </div>
      )}
      <Link className="settings" to="/settings" aria-label="설정">설정</Link>
    </header>
  );
}
