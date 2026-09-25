-- RLS 격리 테스트 (명세 3장 / 6장 완료 기준)
-- 실행: psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_isolation.sql
-- 한 트랜잭션에서 돌고 끝에 rollback 하므로 실제 데이터는 남지 않는다.
-- 실패하면 'FAIL: ...' 예외로 멈춘다.
begin;

create temp table t_ids (k text primary key, v uuid) on commit drop;
grant all on t_ids to authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a1@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'a2@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'b1@test.local'),
  ('00000000-0000-0000-0000-00000000000d', 'third@test.local');

create or replace function pg_temp.login(u text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
end $$;
create or replace function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- 가정 A: a1 생성, a2 합류
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into t_ids select 'hA', id from public.create_household('groom', '준', '김준');
select pg_temp.check((select invite_code ~ '^[A-HJ-NP-Z2-9]{6}$' from public.households), '초대코드는 0,O,1,I 없는 6자리');
select set_config('test.codeA', (select invite_code from public.households), true);

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) = 0 from public.households), '합류 전에는 가정 A 를 코드로 조회할 수 없다');
select public.join_household(lower(current_setting('test.codeA')), '민', null);
select pg_temp.check((select role = 'bride' from public.household_members where user_id = auth.uid()), '합류자는 남은 역할(신부)로 배정');

-- 세 번째 계정은 거절
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
do $$ begin
  perform public.join_household(current_setting('test.codeA'), null, null);
  raise exception 'FAIL: 세 번째 계정이 합류됐다';
exception when raise_exception then
  if sqlerrm <> 'household_full' then raise; end if;
  raise notice 'ok - 세 번째 계정은 household_full 로 거절';
end $$;

-- 가정 A 데이터 채우기
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
with x as (insert into public.complexes (household_id, name, region)
  select v, '가정A 단지', '경기 성남시 분당구' from t_ids where k = 'hA' returning id)
insert into t_ids select 'cxA', id from x;
insert into public.price_records (complex_id, household_id, date, type, price_manwon)
  select (select v from t_ids where k = 'cxA'), (select v from t_ids where k = 'hA'), current_date, '실거래', 55000;
insert into public.visits (household_id, complex_id, date) select (select v from t_ids where k = 'hA'), (select v from t_ids where k = 'cxA'), current_date;
with x as (insert into public.candidates (household_id, complex_id, price_manwon)
  select (select v from t_ids where k = 'hA'), (select v from t_ids where k = 'cxA'), 55000 returning id)
insert into t_ids select 'candA', id from x;
insert into public.candidate_scores (candidate_id, score) select v, 4 from t_ids where k = 'candA';
update public.finances set data = '{"gIncome":6000}' where household_id = (select v from t_ids where k = 'hA');
select pg_temp.check((select updated_by = auth.uid() from public.finances), 'finances.updated_by 는 서버가 채운다');

-- 상대(a2)는 가정 A 데이터를 본다, 내 점수는 못 고친다
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) = 1 from public.complexes), '같은 가정 구성원은 단지를 본다');
select pg_temp.check((select count(*) = 1 from public.candidate_scores), '같은 가정 구성원은 상대 별점을 본다');
update public.candidate_scores set score = 0 where user_id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select score = 4 from public.candidate_scores where user_id = '00000000-0000-0000-0000-00000000000a'), '상대 별점은 수정되지 않는다');
do $$ begin
  insert into public.candidate_scores (candidate_id, user_id, score)
    values ((select v from t_ids where k = 'candA'), '00000000-0000-0000-0000-00000000000a', 1);
  raise exception 'FAIL: 상대 이름으로 별점을 넣었다';
exception when insufficient_privilege then raise notice 'ok - 상대 이름으로 별점 insert 거부';
end $$;

-- 역할 바꾸기
select public.swap_roles();
select pg_temp.check((select role = 'groom' from public.household_members where user_id = auth.uid()), '역할 바꾸기');
select public.swap_roles();

-- 가정 B: b1 혼자
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
insert into t_ids select 'hB', id from public.create_household('bride', null, null);

-- 핵심: 가정 B 사용자로는 가정 A 의 어떤 테이블도 0건
select pg_temp.check((select count(*) = 1 from public.households), 'B: households 는 자기 것만');
select pg_temp.check((select count(*) = 1 from public.household_members), 'B: members 는 자기 것만');
select pg_temp.check((select count(*) = 0 from public.complexes), 'B: 가정 A complexes 0건');
select pg_temp.check((select count(*) = 0 from public.price_records), 'B: 가정 A price_records 0건');
select pg_temp.check((select count(*) = 0 from public.visits), 'B: 가정 A visits 0건');
select pg_temp.check((select count(*) = 0 from public.candidates), 'B: 가정 A candidates 0건');
select pg_temp.check((select count(*) = 0 from public.candidate_scores), 'B: 가정 A candidate_scores 0건');
select pg_temp.check((select count(*) = 1 from public.finances), 'B: finances 는 자기 것만');
select pg_temp.check((select count(*) >= 1 from public.policy_snapshot), '로그인 사용자는 정책을 읽는다');

-- B 가 A 에 쓰기 시도
update public.complexes set name = 'hacked';
update public.finances set data = '{}' where household_id = (select v from t_ids where k = 'hA');
delete from public.visits;
do $$ begin
  insert into public.complexes (household_id, name) values ((select v from t_ids where k = 'hA'), 'x');
  raise exception 'FAIL: B 가 A 에 단지를 넣었다';
exception when insufficient_privilege then raise notice 'ok - B 가 A 에 insert 거부';
end $$;
do $$ begin
  -- 자기 가정 후보에 남의 단지 id 연결
  insert into public.candidates (household_id, complex_id) values ((select v from t_ids where k = 'hB'), (select v from t_ids where k = 'cxA'));
  raise exception 'FAIL: 다른 가정 단지를 참조했다';
exception when insufficient_privilege then raise notice 'ok - 다른 가정 단지 참조 거부';
end $$;
do $$ begin
  insert into public.policy_snapshot (updated_at, items, params, regulated) values (current_date, '[]', '{}', '[]');
  raise exception 'FAIL: 일반 사용자가 정책을 썼다';
exception when insufficient_privilege then raise notice 'ok - 정책 쓰기 거부';
end $$;
do $$ begin
  update public.household_members set role = 'groom';
  raise exception 'FAIL: 역할을 직접 바꿨다';
exception when insufficient_privilege then raise notice 'ok - 역할 직접 수정 거부 (RPC 만)';
end $$;
do $$ begin
  perform public.create_household('groom', null, null);
  raise exception 'FAIL: 두 번째 가정을 만들었다';
exception when raise_exception then
  if sqlerrm <> 'already_in_household' then raise; end if;
  raise notice 'ok - 한 사용자 한 가정';
end $$;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select name = '가정A 단지' from public.complexes), 'A 단지는 B 의 update 에 영향받지 않음');
select pg_temp.check((select count(*) = 1 from public.visits), 'A 임장은 B 의 delete 에 영향받지 않음');
select pg_temp.check((select data->>'gIncome' = '6000' from public.finances), 'A 자금은 B 의 update 에 영향받지 않음');

do $$ begin
  truncate public.complexes cascade;
  raise exception 'FAIL: 일반 사용자가 truncate 했다';
exception when insufficient_privilege then raise notice 'ok - truncate 거부';
end $$;
do $$ begin
  update public.finances set household_id = household_id;
  raise exception 'FAIL: finances 의 data 외 열을 고쳤다';
exception when insufficient_privilege then raise notice 'ok - finances 는 data 열만 수정 가능';
end $$;

-- anon 은 아무것도 못 본다
reset role;
select set_config('role', 'anon', true);
do $$ begin
  perform 1 from public.policy_snapshot;
  raise exception 'FAIL: anon 이 정책을 읽었다';
exception when insufficient_privilege then raise notice 'ok - anon 차단';
end $$;

reset role;
rollback;
