-- 우리 신혼집: 스키마 (명세 3장)
-- 금액 단위는 모두 만원.

create table public.households (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique not null check (invite_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  move_in text check (move_in is null or move_in ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  created_by uuid references auth.users on delete set null,   -- 관리자(가정 생성자) 판정용
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('groom','bride')),
  nick text check (char_length(nick) <= 12),
  display_name text check (char_length(display_name) <= 40),  -- 가입 시 프로필 이름 사본 (상대가 볼 수 있게)
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  -- 역할 바꾸기(swap_roles)에서 한 트랜잭션 안에 두 행을 바꿀 수 있게 deferrable
  constraint household_members_role_unique unique (household_id, role) deferrable initially immediate
);
-- 한 사용자는 한 가정에만 속한다
create unique index one_household_per_user on public.household_members(user_id);

create table public.complexes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  region text,
  reg_override text check (reg_override in ('yes','no')),
  area text, meta text, commute text, memo text,
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.complexes(household_id);

create table public.price_records (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references public.complexes on delete cascade,
  household_id uuid not null references public.households on delete cascade,
  date date not null,
  type text not null check (type in ('실거래','호가','KB시세','전세 실거래','전세 호가')),
  price_manwon int not null check (price_manwon > 0),
  floor text,
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.price_records(household_id);
create index on public.price_records(complex_id, date desc);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  complex_id uuid references public.complexes on delete set null,
  complex_name text,                          -- 단지 삭제 대비
  date date not null,
  ratings jsonb not null default '{}',        -- {traffic,noise,light,manage,life}: 0~5
  commute_groom int check (commute_groom between 0 and 600),
  commute_bride int check (commute_bride between 0 and 600),
  pros text, cons text, memo text,
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.visits(household_id, date desc);

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  complex_id uuid references public.complexes on delete set null,
  deal_type text not null default '매매' check (deal_type in ('매매','전세')),
  status text not null default '관심' check (status in ('관심','연락중','협상중','가계약','계약완료','보류')),
  unit text, area text,
  price_manwon int check (price_manwon is null or price_manwon >= 0),
  memo text,
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.candidates(household_id);

create table public.candidate_scores (
  candidate_id uuid not null references public.candidates on delete cascade,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  score int not null check (score between 0 and 5),
  primary key (candidate_id, user_id)
);

create table public.finances (
  household_id uuid primary key references public.households on delete cascade,
  data jsonb not null default '{}',           -- 명세 2.6 입력값 전부
  updated_by uuid references auth.users on delete set null,
  updated_at timestamptz not null default now()
);

create table public.policy_snapshot (
  id serial primary key,
  updated_at date not null,
  headline text,
  items jsonb not null,                       -- [{date,tag,title,summary,impact,source,url}]
  params jsonb not null,                      -- 계산 파라미터
  regulated jsonb not null                    -- ["서울 *","경기 과천시",...]
);

-- finances.updated_by/updated_at 은 서버가 채운다
create function public.touch_finances() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end $$;
create trigger finances_touch before insert or update on public.finances
for each row execute function public.touch_finances();
