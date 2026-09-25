-- RLS: 같은 가정 구성원만 읽고 쓴다 (명세 3장 RLS 원칙)

create function public.is_member(hid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid()
  );
$$;

-- 다른 가정의 단지 id 를 끌어다 쓰지 못하게
create function public.complex_in_household(cid uuid, hid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select cid is null or exists (select 1 from public.complexes c where c.id = cid and c.household_id = hid);
$$;

create function public.candidate_household(cid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select c.household_id from public.candidates c where c.id = cid;
$$;

revoke all on function public.is_member(uuid), public.complex_in_household(uuid, uuid), public.candidate_household(uuid) from public, anon;
grant execute on function public.is_member(uuid), public.complex_in_household(uuid, uuid), public.candidate_household(uuid) to authenticated;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.complexes enable row level security;
alter table public.price_records enable row level security;
alter table public.visits enable row level security;
alter table public.candidates enable row level security;
alter table public.candidate_scores enable row level security;
alter table public.finances enable row level security;
alter table public.policy_snapshot enable row level security;

-- anon 은 아무것도 못 한다
revoke all on all tables in schema public from anon;
-- Supabase 기본 grant 중 RLS 를 우회하거나 필요 없는 권한은 뺀다
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- households: 구성원만 읽기, 입주 목표 월만 수정. 생성·합류는 RPC 로만.
revoke insert, update, delete on public.households from authenticated;
grant select on public.households to authenticated;
grant update (move_in) on public.households to authenticated;
create policy households_select on public.households for select to authenticated using (public.is_member(id));
create policy households_update on public.households for update to authenticated using (public.is_member(id)) with check (public.is_member(id));

-- household_members: 같은 가정 구성원 읽기, 내 호칭만 수정. 역할 변경은 swap_roles RPC.
revoke insert, update, delete on public.household_members from authenticated;
grant select on public.household_members to authenticated;
grant update (nick) on public.household_members to authenticated;
create policy members_select on public.household_members for select to authenticated using (public.is_member(household_id));
create policy members_update_self on public.household_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 가정 소속 데이터
grant select, insert, update, delete on public.complexes, public.price_records, public.visits, public.candidates to authenticated;

create policy complexes_all on public.complexes for all to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

create policy price_records_all on public.price_records for all to authenticated
  using (public.is_member(household_id))
  with check (public.is_member(household_id) and public.complex_in_household(complex_id, household_id));

create policy visits_all on public.visits for all to authenticated
  using (public.is_member(household_id))
  with check (public.is_member(household_id) and public.complex_in_household(complex_id, household_id));

create policy candidates_all on public.candidates for all to authenticated
  using (public.is_member(household_id))
  with check (public.is_member(household_id) and public.complex_in_household(complex_id, household_id));

-- candidate_scores: 가정 구성원 전체 읽기, 쓰기는 내 행만
grant select, insert, update, delete on public.candidate_scores to authenticated;
create policy scores_select on public.candidate_scores for select to authenticated
  using (public.is_member(public.candidate_household(candidate_id)));
create policy scores_insert on public.candidate_scores for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_member(public.candidate_household(candidate_id)));
create policy scores_update on public.candidate_scores for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_member(public.candidate_household(candidate_id)));
create policy scores_delete on public.candidate_scores for delete to authenticated
  using (user_id = (select auth.uid()));

-- finances: 가정당 1행. 행은 create_household 가 만든다.
revoke insert, update, delete on public.finances from authenticated;
grant select, update (data) on public.finances to authenticated;
create policy finances_select on public.finances for select to authenticated using (public.is_member(household_id));
create policy finances_update on public.finances for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

-- policy_snapshot: 로그인 사용자 읽기, 쓰기는 service role 만 (정책 없음 = 거부)
revoke insert, update, delete on public.policy_snapshot from authenticated;
grant select on public.policy_snapshot to authenticated;
create policy policy_read on public.policy_snapshot for select to authenticated using (true);
