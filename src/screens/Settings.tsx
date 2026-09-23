import { useEffect, useState } from 'react';
import { HouseHeader } from '../components/HouseHeader';
import { useToast } from '../components/Toast';
import { roleLabel } from '../lib/domain';
import { errorMessage } from '../lib/errors';
import { sb } from '../lib/supabase';
import { useApp } from '../state/AppData';

export function Settings() {
  const { household, me, members, reload, session } = useApp();
  const toast = useToast();
  const [moveIn, setMoveIn] = useState(household?.move_in ?? '');
  const [nick, setNick] = useState(me?.nick ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => setMoveIn(household?.move_in ?? ''), [household?.move_in]);
  useEffect(() => setNick(me?.nick ?? ''), [me?.nick]);

  if (!household || !me) return null;

  const save = async () => {
    if (nick.trim().length > 12) return toast('호칭은 12자 이내로 입력해주세요');
    setBusy(true);
    const r1 = await sb().from('households').update({ move_in: moveIn || null }).eq('id', household.id);
    const r2 = await sb().from('household_members').update({ nick: nick.trim() || null }).eq('household_id', household.id).eq('user_id', me.user_id);
    setBusy(false);
    const e = r1.error || r2.error;
    if (e) return toast(errorMessage(e));
    toast('설정을 저장했어요');
    void reload('households');
    void reload('household_members');
  };

  const swap = async () => {
    const { error } = await sb().rpc('swap_roles');
    if (error) return toast(errorMessage(error));
    toast(members.length > 1 ? '신랑·신부 역할을 서로 바꿨어요' : '역할을 바꿨어요');
    void reload('household_members');
  };

  return (
    <>
      <HouseHeader />
      <div className="sec"><h2>설정</h2></div>
      <div className="card">
        <label className="f" htmlFor="moveIn"><span>입주 목표 월</span>
          <input id="moveIn" type="month" value={moveIn} onChange={(e) => setMoveIn(e.target.value)} />
        </label>
        <label className="f" htmlFor="myNick"><span>내 호칭 ({roleLabel(me.role)}, 12자 이내)</span>
          <input id="myNick" type="text" maxLength={12} value={nick} onChange={(e) => setNick(e.target.value)} />
        </label>
        <div className="row">
          <button type="button" className="btn key sm" onClick={save} disabled={busy}>설정 저장</button>
          <button type="button" className="btn sm ghost" onClick={swap}>신랑·신부 바꾸기</button>
        </div>
      </div>
      <div className="card">
        <p className="small muted">{session?.user.email} 로 로그인했어요.</p>
        <button type="button" className="btn sm" onClick={() => sb().auth.signOut()}>로그아웃</button>
      </div>
    </>
  );
}
