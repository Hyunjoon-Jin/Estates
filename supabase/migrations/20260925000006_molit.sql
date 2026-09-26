-- 국토부 실거래가 연동 (명세 2.3 2단계)

-- 단지별 조회 정보: 시군구 코드(LAWD_CD)와 국토부 데이터상의 정확한 단지명
alter table public.complexes
  add column lawd_cd text check (lawd_cd is null or lawd_cd ~ '^\d{5}$'),
  add column molit_name text check (char_length(molit_name) <= 60);

-- 불러온 기록은 출처와 중복 방지 키를 남긴다
alter table public.price_records
  add column source text check (source in ('manual', 'molit')) default 'manual',
  add column source_key text;
create unique index price_records_source_key_uniq on public.price_records(household_id, source_key) where source_key is not null;

-- Edge Function 전용 캐시 (서비스 롤만 접근). 같은 지역·달은 여러 가정이 같이 쓴다.
create table public.molit_cache (
  lawd_cd text not null check (lawd_cd ~ '^\d{5}$'),
  ymd text not null check (ymd ~ '^\d{6}$'),
  kind text not null check (kind in ('trade', 'rent')),
  items jsonb not null default '[]',
  fetched_at timestamptz not null default now(),
  primary key (lawd_cd, ymd, kind)
);
alter table public.molit_cache enable row level security;
revoke all on public.molit_cache from anon, authenticated;
