import { useState, type FormEvent } from 'react';
import { authMessage } from '../lib/errors';
import { oauthFlags, sb } from '../lib/supabase';

type Mode = 'login' | 'signup' | 'reset' | 'magic';
const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  const go = (m: Mode) => {
    setMode(m);
    setErr('');
    setDone('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    const mail = email.trim();
    if (!EMAIL_RE.test(mail)) return setErr('이메일 주소 형식이 맞지 않아요. 예: name@example.com');
    if ((mode === 'login' || mode === 'signup') && pw.length < 8) return setErr('비밀번호는 8자 이상이에요.');
    if (mode === 'signup' && pw !== pw2) return setErr('비밀번호 확인이 달라요. 다시 입력해주세요.');
    setBusy(true);
    const auth = sb().auth;
    const redirect = window.location.origin;
    let error: { message?: string; code?: string } | null = null;
    if (mode === 'login') {
      ({ error } = await auth.signInWithPassword({ email: mail, password: pw }));
    } else if (mode === 'signup') {
      const r = await auth.signUp({ email: mail, password: pw, options: { emailRedirectTo: redirect } });
      error = r.error;
      // 이메일 확인이 꺼져 있으면 바로 로그인된다(session 있음). 켜져 있으면 확인 메일 안내.
      if (!error && !r.data.session) setDone(`${mail} 로 가입 확인 메일을 보냈어요. 링크를 한 번만 누르면, 그다음부터는 비밀번호로 로그인해요.`);
    } else if (mode === 'reset') {
      ({ error } = await auth.resetPasswordForEmail(mail, { redirectTo: redirect }));
      if (!error) setDone(`${mail} 로 비밀번호 재설정 링크를 보냈어요. 링크를 누르면 새 비밀번호를 정할 수 있어요.`);
    } else {
      ({ error } = await auth.signInWithOtp({ email: mail, options: { emailRedirectTo: redirect } }));
      if (!error) setDone(`${mail} 로 로그인 링크를 보냈어요.`);
    }
    setBusy(false);
    if (error) setErr(authMessage(error));
  };

  const oauth = async (provider: 'kakao' | 'google') => {
    const { error } = await sb().auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
    if (error) setErr('로그인 창을 열지 못했어요. 잠시 뒤 다시 시도해주세요.');
  };

  const title = { login: '로그인', signup: '회원가입', reset: '비밀번호 재설정', magic: '메일 링크로 로그인' }[mode];
  const cta = { login: '로그인', signup: '가입하기', reset: '재설정 링크 받기', magic: '로그인 링크 받기' }[mode];

  return (
    <main className="wrap">
      <div className="center onb">
        <h1>우리 신혼집</h1>
        <p className="muted">시세, 임장 기록, 계약 후보, 대출 계산을 둘이 같이 쓰는 노트예요.</p>
        <div className="card" style={{ marginTop: 18 }}>
          {(mode === 'login' || mode === 'signup') && (
            <div className="seg" role="tablist" aria-label="로그인 또는 가입" style={{ display: 'flex', marginBottom: 14 }}>
              <button type="button" role="tab" aria-selected={mode === 'login'} aria-pressed={mode === 'login'} style={{ flex: 1 }} onClick={() => go('login')}>로그인</button>
              <button type="button" role="tab" aria-selected={mode === 'signup'} aria-pressed={mode === 'signup'} style={{ flex: 1 }} onClick={() => go('signup')}>회원가입</button>
            </div>
          )}
          {(mode === 'reset' || mode === 'magic') && <h3 style={{ marginBottom: 10 }}>{title}</h3>}

          {done ? (
            <>
              <p className="small" role="status">{done}</p>
              <button type="button" className="btn sm ghost" onClick={() => go('login')}>로그인 화면으로</button>
            </>
          ) : (
            <form onSubmit={submit} noValidate>
              <label className="f" htmlFor="email"><span>이메일</span>
                <input id="email" type="email" inputMode="email" autoComplete={mode === 'signup' ? 'email' : 'username'} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
              </label>
              {(mode === 'login' || mode === 'signup') && (
                <label className="f" htmlFor="pw"><span>비밀번호 {mode === 'signup' && '(8자 이상)'}</span>
                  <div className="unit">
                    <input id="pw" type={showPw ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} style={{ paddingRight: 64 }} />
                    <button type="button" className="pwtoggle" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}>{showPw ? '숨기기' : '보기'}</button>
                  </div>
                </label>
              )}
              {mode === 'signup' && (
                <label className="f" htmlFor="pw2"><span>비밀번호 확인</span>
                  <input id="pw2" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
                </label>
              )}
              {err && <p className="err" role="alert">{err}</p>}
              <button className="btn key" type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? '잠시만요…' : cta}</button>
            </form>
          )}

          {!done && (
            <div className="row" style={{ marginTop: 12, gap: 4, justifyContent: 'center' }}>
              {mode !== 'login' && <button type="button" className="btn sm ghost" onClick={() => go('login')}>로그인</button>}
              {mode !== 'reset' && <button type="button" className="btn sm ghost" onClick={() => go('reset')}>비밀번호 재설정</button>}
              {mode !== 'magic' && <button type="button" className="btn sm ghost" onClick={() => go('magic')}>메일 링크로 로그인</button>}
            </div>
          )}

          {(oauthFlags.kakao || oauthFlags.google) && (
            <div className="row" style={{ marginTop: 14 }}>
              {oauthFlags.kakao && <button type="button" className="btn" onClick={() => oauth('kakao')}>카카오로 계속하기</button>}
              {oauthFlags.google && <button type="button" className="btn" onClick={() => oauth('google')}>구글로 계속하기</button>}
            </div>
          )}
        </div>
        <p className="hint" style={{ textAlign: 'center' }}>한 번 로그인하면 로그아웃하기 전까지 이 기기에서 계속 유지돼요.</p>
      </div>
    </main>
  );
}

/** 재설정 메일 링크로 들어왔을 때 새 비밀번호 정하기. 설정 화면의 '비밀번호 정하기'도 같이 쓴다. */
export function SetPassword({ onDone, title = '새 비밀번호 정하기' }: { onDone: () => void; title?: string }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    if (pw.length < 8) return setErr('비밀번호는 8자 이상이에요.');
    if (pw !== pw2) return setErr('비밀번호 확인이 달라요. 다시 입력해주세요.');
    setBusy(true);
    const { error } = await sb().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(authMessage(error));
    setPw('');
    setPw2('');
    onDone();
  };

  return (
    <form onSubmit={submit} noValidate>
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      <label className="f" htmlFor="npw"><span>새 비밀번호 (8자 이상)</span>
        <input id="npw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </label>
      <label className="f" htmlFor="npw2"><span>새 비밀번호 확인</span>
        <input id="npw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </label>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn key sm" type="submit" disabled={busy}>{busy ? '저장 중…' : '비밀번호 저장'}</button>
    </form>
  );
}
