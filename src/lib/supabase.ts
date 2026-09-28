import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** 환경변수가 없으면 null. App 이 설정 안내 화면을 보여준다. */
// 로그인 상태는 이 기기(브라우저)에 저장하고 자동으로 연장한다. 한 번 로그인하면 로그아웃 전까지 유지된다.
export const supabase: SupabaseClient | null = url && key
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export const oauthFlags = {
  kakao: import.meta.env.VITE_OAUTH_KAKAO === 'true',
  google: import.meta.env.VITE_OAUTH_GOOGLE === 'true',
};

export function sb(): SupabaseClient {
  if (!supabase) throw new Error('Supabase 환경변수가 없어요');
  return supabase;
}
