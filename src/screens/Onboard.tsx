import { useState } from 'react';
import { errorMessage } from '../lib/errors';
import { sb } from '../lib/supabase';
import type { Role } from '../lib/types';
import { useApp } from '../state/AppData';
import { useToast } from '../components/Toast';

export function Onboard() {
  const { session, reload } = useApp();
  const toast = useToast();
  const [role, setRole] = useState<Role>('groom');
  const [nickNew, setNickNew] = useState('');
  const [code, setCode] = useState('');
  const [nickJoin, setNickJoin] = useState('');
  const [err, setErr] = useState<{ where: 'create' | 'join'; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const meta = session?.user.user_metadata ?? {};
  const displayName = (meta.full_name || meta.name || meta.nickname || '') as string;

  const create = async () => {
    setBusy(true);
    setErr(null);
    const { error } = await sb().rpc('create_household', { p_role: role, p_nick: nickNew.trim() || null, p_display_name: displayName || null });
    setBusy(false);
    if (error) return setErr({ where: 'create', msg: errorMessage(error) });
    toast('가정을 만들었어요');
    await reload();
  };

  const join = async () => {
    const c = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(c)) return setErr({ where: 'join', msg: '짝꿍에게 받은 코드 6자리를 입력해주세요.' });
    setBusy(true);
    setErr(null);
    const { error } = await sb().rpc('join_household', { p_code: c, p_nick: nickJoin.trim() || null, p_display_name: displayName || null });
    setBusy(false);
    if (error) return setErr({ where: 'join', msg: errorMessage(error) });
    toast('합류했어요');
    await reload();
  };

  return (
    <main className="wrap">
      <div className="center onb">
        <h1>우리 신혼집</h1>
        <p className="muted">한 사람이 가정을 만들고, 다른 사람은 초대코드로 들어오면 돼요.</p>
        <section className="card" style={{ marginTop: 18 }} aria-labelledby="h-create">
          <h3 id="h-create">가정 만들기</h3>
          <p className="small muted">나는</p>
          <div className="row" style={{ margin: '6px 0 12px' }}>
            <div className="seg" role="group" aria-label="역할">
              <button type="button" aria-pressed={role === 'groom'} onClick={() => setRole('groom')}>신랑</button>
              <button type="button" aria-pressed={role === 'bride'} onClick={() => setRole('bride')}>신부</button>
            </div>
          </div>
          <label className="f" htmlFor="nickNew"><span>부를 이름 (선택, 12자 이내)</span>
            <input id="nickNew" type="text" maxLength={12} value={nickNew} onChange={(e) => setNickNew(e.target.value)} placeholder="예: 현준" />
          </label>
          {err?.where === 'create' && <p className="err" role="alert">{err.msg}</p>}
          <button type="button" className="btn key" onClick={create} disabled={busy}>가정 만들기</button>
        </section>
        <section className="card" aria-labelledby="h-join">
          <h3 id="h-join">초대코드로 합류</h3>
          <label className="f" htmlFor="joinCode" style={{ marginTop: 8 }}><span>짝꿍에게 받은 6자리 코드</span>
            <input id="joinCode" type="text" maxLength={6} autoComplete="off" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} style={{ textTransform: 'uppercase', letterSpacing: '.2em' }} />
          </label>
          <label className="f" htmlFor="nickJoin"><span>부를 이름 (선택, 12자 이내)</span>
            <input id="nickJoin" type="text" maxLength={12} value={nickJoin} onChange={(e) => setNickJoin(e.target.value)} />
          </label>
          <p className="hint">역할(신랑·신부)은 남은 쪽으로 자동 배정돼요. 설정에서 바꿀 수 있어요.</p>
          {err?.where === 'join' && <p className="err" role="alert">{err.msg}</p>}
          <button type="button" className="btn" onClick={join} disabled={busy}>합류하기</button>
        </section>
        <button type="button" className="btn sm ghost" onClick={() => sb().auth.signOut()}>로그아웃</button>
      </div>
    </main>
  );
}
