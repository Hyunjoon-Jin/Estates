import type { RealtimeChannel, Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { mergeParams, withFinDefaults, type FinInput, type Params } from '../lib/finance';
import { supabase } from '../lib/supabase';
import type {
  Candidate, CandidateScore, Complex, Finances, Household, Member, PolicySnapshot, PriceRecord, Visit,
} from '../lib/types';

type Table =
  | 'households' | 'household_members' | 'complexes' | 'price_records'
  | 'visits' | 'candidates' | 'candidate_scores' | 'finances' | 'policy_snapshot';

export interface AppData {
  session: Session | null;
  authReady: boolean;
  /** 비밀번호 재설정 메일 링크로 들어온 상태 */
  recovery: boolean;
  endRecovery: () => void;
  uid: string | null;
  /** undefined = 아직 모름, null = 소속 가정 없음 */
  hid: string | null | undefined;
  household: Household | null;
  members: Member[];
  me: Member | null;
  complexes: Complex[];
  prices: PriceRecord[];
  visits: Visit[];
  candidates: Candidate[];
  scores: CandidateScore[];
  finances: Finances | null;
  /** 기본값을 채운 자금 입력 (모든 화면 계산 공용) */
  fin: FinInput;
  policy: PolicySnapshot | null;
  params: Params;
  reload: (t?: Table) => Promise<void>;
  /** 저장 직후 화면에 바로 반영 (Realtime 도착 전) */
  setFinancesLocal: (data: FinInput) => void;
}

const Ctx = createContext<AppData | null>(null);

export function useApp(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppDataProvider 밖');
  return v;
}

const HOUSEHOLD_TABLES: Table[] = ['complexes', 'price_records', 'visits', 'candidates', 'finances', 'household_members'];

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [hid, setHid] = useState<string | null | undefined>(undefined);
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [prices, setPrices] = useState<PriceRecord[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [scores, setScores] = useState<CandidateScore[]>([]);
  const [finances, setFinances] = useState<Finances | null>(null);
  const [policy, setPolicy] = useState<PolicySnapshot | null>(null);

  const uid = session?.user.id ?? null;

  // 인증
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // 내 가정 찾기
  const findHousehold = useCallback(async () => {
    if (!supabase || !uid) {
      setHid(uid ? undefined : null);
      return;
    }
    const { data } = await supabase.from('household_members').select('household_id').eq('user_id', uid).maybeSingle();
    setHid(data?.household_id ?? null);
  }, [uid]);

  useEffect(() => {
    setHid(undefined);
    void findHousehold();
  }, [findHousehold]);

  const loaders = useMemo(() => {
    const db = supabase;
    const h = hid;
    const ok = <T,>(r: { data: T | null; error: unknown }, set: (v: T) => void) => {
      if (!r.error && r.data) set(r.data);
    };
    return {
      policy_snapshot: async () => {
        if (!db) return;
        const r = await db.from('policy_snapshot').select('*').order('updated_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
        if (!r.error) setPolicy((r.data as PolicySnapshot) ?? null);
      },
      households: async () => {
        if (!db || !h) return;
        ok(await db.from('households').select('*').eq('id', h).maybeSingle(), (v) => setHousehold(v as unknown as Household));
      },
      household_members: async () => {
        if (!db || !h) return;
        ok(await db.from('household_members').select('*').eq('household_id', h), (v) => setMembers(v as Member[]));
      },
      complexes: async () => {
        if (!db || !h) return;
        ok(await db.from('complexes').select('*').eq('household_id', h).order('created_at', { ascending: false }), (v) => setComplexes(v as Complex[]));
      },
      price_records: async () => {
        if (!db || !h) return;
        ok(await db.from('price_records').select('*').eq('household_id', h).order('date', { ascending: true }), (v) => setPrices(v as PriceRecord[]));
      },
      visits: async () => {
        if (!db || !h) return;
        ok(await db.from('visits').select('*').eq('household_id', h).order('date', { ascending: false }).order('created_at', { ascending: false }), (v) => setVisits(v as Visit[]));
      },
      candidates: async () => {
        if (!db || !h) return;
        ok(await db.from('candidates').select('*').eq('household_id', h).order('created_at', { ascending: false }), (v) => setCandidates(v as Candidate[]));
      },
      candidate_scores: async () => {
        if (!db || !h) return;
        // RLS 가 같은 가정 후보의 점수만 돌려준다
        ok(await db.from('candidate_scores').select('*'), (v) => setScores(v as CandidateScore[]));
      },
      finances: async () => {
        if (!db || !h) return;
        ok(await db.from('finances').select('*').eq('household_id', h).maybeSingle(), (v) => setFinances(v as unknown as Finances));
      },
    } satisfies Record<Table, () => Promise<void>>;
  }, [hid]);

  const reload = useCallback(
    async (t?: Table) => {
      if (t) return loaders[t]();
      await Promise.all(Object.values(loaders).map((f) => f()));
    },
    [loaders],
  );

  // 가정이 정해지면 전체 로드 + Realtime 구독
  useEffect(() => {
    if (!supabase || !uid) return;
    if (!hid) {
      void loaders.policy_snapshot();
      return;
    }
    const db = supabase;
    void reload();

    const timers = new Map<Table, ReturnType<typeof setTimeout>>();
    const bump = (t: Table) => {
      clearTimeout(timers.get(t));
      timers.set(t, setTimeout(() => void loaders[t](), 120));
    };

    // postgres_changes 는 RLS 를 따른다. 삭제 이벤트는 필터가 적용되지 않으므로 따로 받는다.
    let ch: RealtimeChannel = db.channel(`household:${hid}`);
    for (const t of HOUSEHOLD_TABLES) {
      ch = ch
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: t, filter: `household_id=eq.${hid}` }, () => bump(t))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: t, filter: `household_id=eq.${hid}` }, () => bump(t))
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: t }, () => bump(t));
    }
    ch = ch
      .on('postgres_changes', { event: '*', schema: 'public', table: 'households', filter: `id=eq.${hid}` }, () => bump('households'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidate_scores' }, () => bump('candidate_scores'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'policy_snapshot' }, () => bump('policy_snapshot'))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'household_members' }, () => {
        bump('household_members');
        void findHousehold();
      });
    ch.subscribe((status) => {
      // 끊겼다 다시 붙으면 그 사이 놓친 변경을 채운다
      if (status === 'SUBSCRIBED') void reload();
    });

    // 탭으로 돌아오면 정책 수치 포함 전체 새로 읽기 (재배포 없이 정책 반영)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      timers.forEach((x) => clearTimeout(x));
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      void db.removeChannel(ch);
    };
  }, [hid, uid, loaders, reload, findHousehold]);

  // 로그아웃 시 비우기
  useEffect(() => {
    if (uid) return;
    setHousehold(null);
    setMembers([]);
    setComplexes([]);
    setPrices([]);
    setVisits([]);
    setCandidates([]);
    setScores([]);
    setFinances(null);
  }, [uid]);

  const params = useMemo(() => mergeParams(policy?.params as never, policy?.regulated), [policy]);
  const fin = useMemo(() => withFinDefaults(finances?.data), [finances]);
  const me = useMemo(() => members.find((m) => m.user_id === uid) ?? null, [members, uid]);

  const setFinancesLocal = useCallback(
    (data: FinInput) => setFinances((f) => (f ? { ...f, data } : f)),
    [],
  );

  // hid 가 새로 생기면(가정 만들기/합류 직후) 다시 찾도록 노출
  const value: AppData = {
    session, authReady, recovery, endRecovery: () => setRecovery(false), uid, hid, household, members, me, complexes, prices, visits, candidates, scores,
    finances, fin, policy, params,
    reload: async (t) => {
      if (!t) await findHousehold();
      await reload(t);
    },
    setFinancesLocal,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
