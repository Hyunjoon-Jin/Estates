-- 두 사람이 동시에 봐도 반영되도록 Realtime (postgres_changes) 발행.
-- postgres_changes 는 RLS 를 따르므로 다른 가정 행은 전달되지 않는다.
alter publication supabase_realtime add table
  public.households, public.household_members, public.complexes, public.price_records,
  public.visits, public.candidates, public.candidate_scores, public.finances, public.policy_snapshot;
