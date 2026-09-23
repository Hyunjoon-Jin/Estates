import { useState, type FormEvent } from 'react';
import { oauthFlags, sb } from '../lib/supabase';

export function AuthScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErr('이메일 주소 형식이 맞지 않아요. 예: name@example.com');
      return;
    }
    setBusy(true);
    const { error } = await sb().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) setErr(/rate/i.test(error.message) ? '메일을 너무 자주 요청했어요. 1분쯤 뒤 다시 시도해주세요.' : '로그인 메일을 보내지 못했어요. 주소를 확인하고 다시 시도해주세요.');
    else setSent(true);
  };

  const oauth = async (provider: 'kakao' | 'google') => {
    const { error } = await sb().auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
    if (error) setErr('로그인 창을 열지 못했어요. 잠시 뒤 다시 시도해주세요.');
  };

  return (
    <main className="wrap">
      <div className="center onb">
        <h1>우리 신혼집</h1>
        <p className="muted">시세, 임장 기록, 계약 후보, 대출 계산을 둘이 같이 쓰는 노트예요.</p>
        <div className="card" style={{ marginTop: 18 }}>
          {sent ? (
            <>
              <h3>메일함을 확인해주세요</h3>
              <p className="small">{email} 로 로그인 링크를 보냈어요. 링크를 누르면 이 화면으로 돌아와요.</p>
              <button type="button" className="btn sm ghost" onClick={() => setSent(false)}>다른 주소로 받기</button>
            </>
          ) : (
            <form onSubmit={submit} noValidate>
              <label className="f" htmlFor="email">
                <span>이메일</span>
                <input id="email" type="text" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
              </label>
              {err && <p className="err" role="alert">{err}</p>}
              <button className="btn key" type="submit" disabled={busy}>{busy ? '보내는 중…' : '로그인 링크 받기'}</button>
            </form>
          )}
          {(oauthFlags.kakao || oauthFlags.google) && (
            <div className="row" style={{ marginTop: 14 }}>
              {oauthFlags.kakao && <button type="button" className="btn" onClick={() => oauth('kakao')}>카카오로 계속하기</button>}
              {oauthFlags.google && <button type="button" className="btn" onClick={() => oauth('google')}>구글로 계속하기</button>}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
