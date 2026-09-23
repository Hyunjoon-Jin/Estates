/**
 * 실제 Supabase 프로젝트에 붙는 RLS 통합 테스트 (명세 6장: 다른 가정 데이터가 API 로도 조회되지 않는다).
 * .env.test 에 SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY 를 넣고 `npm run test:rls`.
 * service role 키는 테스트 계정 생성·정리에만 쓴다. 절대 VITE_ 로 노출하지 말 것.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

function loadEnv() {
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  if (existsSync('.env.test')) {
    for (const line of readFileSync('.env.test', 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2];
    }
  }
  return env;
}
const env = loadEnv();
const URL = env.SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ready = !!(URL && ANON && SERVICE);

const TABLES = ['complexes', 'price_records', 'visits', 'candidates', 'candidate_scores', 'finances'] as const;
const stamp = Date.now();
const PASSWORD = `Rls-${stamp}-pw!`;

describe.skipIf(!ready)('RLS: 가정 간 격리', () => {
  const admin = ready ? createClient(URL, SERVICE, { auth: { persistSession: false } }) : (null as never);
  const users: { id: string; client: SupabaseClient }[] = [];
  let hA = '';
  let hB = '';
  let codeA = '';

  async function makeUser(tag: string) {
    const email = `rls-${tag}-${stamp}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error) throw error;
    const client = createClient(URL, ANON, { auth: { persistSession: false } });
    const { error: e2 } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (e2) throw e2;
    const u = { id: data.user.id, client };
    users.push(u);
    return u;
  }

  beforeAll(async () => {
    const a1 = await makeUser('a1');
    const a2 = await makeUser('a2');
    await makeUser('b1');
    await makeUser('third');

    const { data: h, error } = await a1.client.rpc('create_household', { p_role: 'groom', p_nick: '준' });
    if (error) throw error;
    hA = h.id;
    codeA = h.invite_code;
    const j = await a2.client.rpc('join_household', { p_code: codeA, p_nick: '민' });
    if (j.error) throw j.error;

    const { data: cx } = await a1.client.from('complexes').insert({ household_id: hA, name: 'RLS 단지', region: '경기 고양시' }).select().single();
    await a1.client.from('price_records').insert({ household_id: hA, complex_id: cx!.id, date: '2026-09-01', type: '실거래', price_manwon: 70000 });
    await a1.client.from('visits').insert({ household_id: hA, complex_id: cx!.id, date: '2026-09-02' });
    const { data: cand } = await a1.client.from('candidates').insert({ household_id: hA, complex_id: cx!.id, price_manwon: 70000 }).select().single();
    await a1.client.from('candidate_scores').insert({ candidate_id: cand!.id, score: 5 });
    await a1.client.from('finances').update({ data: { gIncome: 6000 } }).eq('household_id', hA);

    const { data: hb, error: eb } = await users[2].client.rpc('create_household', { p_role: 'bride' });
    if (eb) throw eb;
    hB = hb.id;
  });

  afterAll(async () => {
    if (!ready) return;
    for (const id of [hA, hB].filter(Boolean)) await admin.from('households').delete().eq('id', id);
    for (const u of users) await admin.auth.admin.deleteUser(u.id);
  });

  it('세 번째 계정은 합류가 거절된다', async () => {
    const { error } = await users[3].client.rpc('join_household', { p_code: codeA });
    expect(error?.message).toBe('household_full');
  });

  it('가정 A 구성원은 A 데이터를 본다', async () => {
    for (const t of TABLES) {
      const { data, error } = await users[1].client.from(t).select('*');
      expect(error, t).toBeNull();
      expect(data!.length, t).toBeGreaterThan(0);
    }
  });

  it('가정 B 사용자로는 가정 A 의 모든 테이블이 0건', async () => {
    const b = users[2].client;
    for (const t of TABLES) {
      const q = t === 'candidate_scores' ? b.from(t).select('*') : b.from(t).select('*').eq('household_id', hA);
      const { data, error } = await q;
      expect(error, t).toBeNull();
      expect(data, t).toEqual([]);
    }
    const { data: hs } = await b.from('households').select('*');
    expect(hs!.map((h) => h.id)).toEqual([hB]);
    const { data: ms } = await b.from('household_members').select('*').eq('household_id', hA);
    expect(ms).toEqual([]);
  });

  it('로그인하지 않으면 정책도 못 읽는다', async () => {
    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    const { data } = await anon.from('policy_snapshot').select('id');
    expect(data ?? []).toEqual([]);
  });
});
