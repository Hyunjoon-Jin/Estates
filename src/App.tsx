import { Navigate, Route, Routes } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { supabase } from './lib/supabase';
import { AuthScreen } from './screens/Auth';
import { Candidates } from './screens/Candidates';
import { Deals } from './screens/Deals';
import { Home } from './screens/Home';
import { Money } from './screens/Money';
import { Onboard } from './screens/Onboard';
import { Policy } from './screens/Policy';
import { Price } from './screens/Price';
import { Settings } from './screens/Settings';
import { Visits } from './screens/Visits';
import { useApp } from './state/AppData';

function Loading({ text = '불러오는 중…' }: { text?: string }) {
  return <main className="wrap"><div className="center"><p className="muted" role="status">{text}</p></div></main>;
}

export function App() {
  const { authReady, session, hid, household } = useApp();

  if (!supabase) {
    return (
      <main className="wrap"><div className="center onb">
        <h1>우리 신혼집</h1>
        <p className="muted">Supabase 연결 정보가 없어요. <code>.env.example</code>을 <code>.env</code>로 복사하고 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 채운 뒤 다시 실행해주세요.</p>
      </div></main>
    );
  }
  if (!authReady) return <Loading />;
  if (!session) return <AuthScreen />;
  if (hid === undefined) return <Loading text="가정 정보를 확인하는 중…" />;
  if (hid === null) return <Onboard />;
  if (!household) return <Loading text="가정 정보를 불러오는 중…" />;

  return (
    <>
      <main className="wrap">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/price" element={<Price />} />
          <Route path="/deals" element={<Deals />} />
          <Route path="/visit" element={<Visits />} />
          <Route path="/cand" element={<Candidates />} />
          <Route path="/money" element={<Money />} />
          <Route path="/policy" element={<Policy />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </>
  );
}
