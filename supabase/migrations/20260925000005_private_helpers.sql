-- RLS 헬퍼 함수는 정책에서만 쓰므로 API(/rest/v1/rpc)에 노출되지 않는 private 스키마로 옮긴다.
-- 정책은 함수를 OID 로 참조하므로 스키마를 옮겨도 그대로 동작한다.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.is_member(uuid) set schema private;
alter function public.complex_in_household(uuid, uuid) set schema private;
alter function public.candidate_household(uuid) set schema private;
alter function public.gen_invite_code() set schema private;

-- create_household 는 search_path 가 비어 있어 이름을 스키마까지 적어 부른다
create or replace function public.create_household(p_role text, p_nick text default null, p_display_name text default null)
returns public.households
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  h public.households;
  tries int := 0;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_role not in ('groom','bride') then raise exception 'invalid_role'; end if;
  if char_length(coalesce(p_nick, '')) > 12 then raise exception 'nick_too_long'; end if;
  if exists (select 1 from public.household_members where user_id = uid) then
    raise exception 'already_in_household';
  end if;

  loop
    begin
      insert into public.households (invite_code, created_by)
      values (private.gen_invite_code(), uid) returning * into h;
      exit;
    exception when unique_violation then
      tries := tries + 1;
      if tries > 10 then raise exception 'invite_code_exhausted'; end if;
    end;
  end loop;

  insert into public.household_members (household_id, user_id, role, nick, display_name)
  values (h.id, uid, p_role, nullif(trim(p_nick), ''), left(nullif(trim(p_display_name), ''), 40));
  insert into public.finances (household_id) values (h.id);
  return h;
end $$;

-- 외래키 조회용 인덱스 (단지 삭제 시 set null, 별점 조회)
create index if not exists candidates_complex_id_idx on public.candidates(complex_id);
create index if not exists visits_complex_id_idx on public.visits(complex_id);
create index if not exists candidate_scores_user_id_idx on public.candidate_scores(user_id);
