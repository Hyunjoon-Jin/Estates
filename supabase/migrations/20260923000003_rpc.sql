-- 가정 만들기 / 초대코드 합류 / 역할 바꾸기
-- 오류는 SQLSTATE P0001 + 메시지 코드로 돌려주고, 클라이언트가 한국어 안내로 바꾼다.

create function public.gen_invite_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- 0,O,1,I 제외 (32자)
  bytes bytea := decode(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'hex');
  code text := '';
begin
  for i in 0..5 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return code;
end $$;

create function public.create_household(p_role text, p_nick text default null, p_display_name text default null)
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
      values (public.gen_invite_code(), uid) returning * into h;
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

create function public.join_household(p_code text, p_nick text default null, p_display_name text default null)
returns public.households
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  h public.households;
  cnt int;
  taken text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if char_length(coalesce(p_nick, '')) > 12 then raise exception 'nick_too_long'; end if;
  if exists (select 1 from public.household_members where user_id = uid) then
    raise exception 'already_in_household';
  end if;

  select * into h from public.households where invite_code = upper(trim(p_code)) for update;
  if not found then raise exception 'invalid_code'; end if;

  select count(*), min(role) into cnt, taken from public.household_members where household_id = h.id;
  if cnt >= 2 then raise exception 'household_full'; end if;

  insert into public.household_members (household_id, user_id, role, nick, display_name)
  values (h.id, uid, case when taken = 'groom' then 'bride' else 'groom' end,
          nullif(trim(p_nick), ''), left(nullif(trim(p_display_name), ''), 40));
  return h;
end $$;

create function public.swap_roles() returns void
language plpgsql security definer set search_path = '' as $$
declare
  hid uuid;
begin
  select household_id into hid from public.household_members where user_id = auth.uid();
  if hid is null then raise exception 'not_member'; end if;
  perform 1 from public.households where id = hid for update;
  set constraints public.household_members_role_unique deferred;
  update public.household_members
     set role = case role when 'groom' then 'bride' else 'groom' end
   where household_id = hid;
end $$;

revoke all on function public.gen_invite_code() from public, anon, authenticated;
revoke all on function public.create_household(text, text, text), public.join_household(text, text, text), public.swap_roles() from public, anon;
grant execute on function public.create_household(text, text, text), public.join_household(text, text, text), public.swap_roles() to authenticated;

-- 자금 입력은 바뀐 키만 합친다. 두 사람이 서로 다른 칸을 동시에 고쳐도 상대 입력을 덮어쓰지 않는다.
create function public.patch_finances(p_patch jsonb) returns public.finances
language plpgsql security invoker set search_path = '' as $$
declare
  hid uuid;
  f public.finances;
begin
  select household_id into hid from public.household_members where user_id = auth.uid();
  if hid is null then raise exception 'not_member'; end if;
  if jsonb_typeof(p_patch) <> 'object' then raise exception 'invalid_patch'; end if;
  update public.finances
     set data = jsonb_strip_nulls(data || p_patch)
   where household_id = hid
  returning * into f;
  return f;
end $$;
revoke all on function public.patch_finances(jsonb) from public, anon;
grant execute on function public.patch_finances(jsonb) to authenticated;
