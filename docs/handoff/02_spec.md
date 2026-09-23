# 우리 신혼집 — 상세 명세

작성일: 2026-09-23
기준 프로토타입: `04_prototype.html` (claude.ai 게시본)

---

## 1. 목적과 사용자

결혼을 앞둔 두 사람이 신혼집을 구하는 과정을 **한 곳에서 같이** 관리하는 웹앱이다.

- 사용자는 한 가정(household)당 2명이다. 각자 로그인한 뒤 서로를 신랑·신부로 연결한다.
- 주 사용 환경은 모바일 브라우저이고, 데스크톱에서도 깨지지 않아야 한다.
- 핵심 질문은 "이 집, 우리가 살 수 있나?"다. 모든 화면은 이 질문에 답하는 쪽으로 설계한다.

## 2. 기능 범위

### 2.1 인증과 가정 연결
- Supabase Auth를 쓴다. 이메일 매직링크를 기본으로 하고, 가능하면 카카오와 구글 OAuth도 붙인다.
- 첫 로그인 뒤에는 두 선택지 중 하나를 고른다.
  - **가정 만들기**: 역할(신랑/신부)과 호칭(선택, 12자 이내)을 입력한다. 그러면 6자리 초대코드가 생성된다. 코드는 헷갈리는 문자(0, O, 1, I)를 뺀 대문자와 숫자로 만든다.
  - **초대코드로 합류**: 코드와 호칭을 입력한다. 역할은 남은 쪽으로 자동 배정된다.
- 한 가정은 최대 2명이다. 이미 2명인 가정의 코드는 거절한다.
- 설정 화면에서 할 수 있는 일은 세 가지다.
  - 입주 목표 월 설정
  - 내 호칭 수정
  - 신랑·신부 역할 서로 바꾸기
- 한 사람만 있는 동안에는 홈 헤더에 초대코드와 복사 버튼을 보여준다.

### 2.2 홈
- 헤더: 신랑·신부 이름(호칭 → 프로필 이름 → "신랑/신부" 순으로 대체)과 입주 목표 D-day를 보여준다.
- 통계 3칸: 관심 단지 수, 임장 기록 수, 계약 후보 수(보류 제외). 누르면 해당 탭으로 이동한다.
- **예산 눈금자**: 이 앱에서 가장 눈에 띄어야 하는 요소다.
  - 가로 막대 위에 두 구간을 음영으로 표시한다. "규제지역 최대 매수가"와 "비규제 수도권 최대 매수가"다.
  - 매매 후보들을 세로선으로 찍고, 위에 단지명 앞 6글자를 라벨로 단다.
  - 자금 정보가 비어 있으면 빈 상태 안내와 "자금 입력하기" 버튼을 보여준다.
- 최근 임장 3건을 보여준다.

### 2.3 시세 (관심 단지)
- 단지 필드: 이름, 지역(시군구 선택), 규제지역 수동 지정(자동/예/아니오), 관심 평형, 세대수·연식, 출퇴근 메모, 메모.
- 시세 기록 필드: 날짜, 구분(실거래 / 호가 / KB시세 / 전세 실거래 / 전세 호가), 가격(만원), 층·평형, 기록자.
- 단지 목록 카드에는 최신 시세, 규제지역 배지, 임장 횟수, 스파크라인(기록 2건 이상일 때)을 표시한다.
- 단지 상세에서는 외부 링크를 제공한다.
  - 네이버부동산 `https://m.land.naver.com/search/result/{단지명}`
  - 호갱노노 `https://hogangnono.com/search?q={단지명}`
  - 국토부 실거래가 `https://rt.molit.go.kr/`
  - KB부동산 `https://kbland.kr/`
- **2단계 과제(선택)**: 공공데이터포털의 국토교통부 아파트 매매·전월세 실거래가 API를 Supabase Edge Function으로 호출해 실거래가를 자동으로 가져온다.
  - 서비스키는 서버에만 둔다.
  - 법정동코드(LAWD_CD)와 거래월로 조회한 뒤 단지명으로 매칭한다.
  - 구현 전에 API 명세를 직접 확인할 것.

### 2.4 임장
- 필드:
  - 단지(선택)와 다녀온 날
  - 별점 5항목(각 0~5): 교통, 소음·층간, 채광·향, 단지 관리, 생활 편의
  - 출근 시간(분): 신랑, 신부
  - 좋았던 점, 아쉬운 점, 메모
  - 기록자(자동)
- 카드 왼쪽 띠 색으로 기록자를 구분한다. 신랑은 파랑, 신부는 분홍이다.
- 둘 다 서로의 기록을 수정할 수 있다.

### 2.5 계약 후보
- 필드: 단지, 거래(매매/전세), 상태, 동·호, 면적, 가격(매매가 또는 보증금, 만원), 메모.
- 상태 값은 관심, 연락중, 협상중, 가계약, 계약완료, 보류 중 하나다.
- 상단에 상태 필터 칩을 둔다.
- 선호 별점은 사람마다 따로 저장한다. 내 별점만 수정할 수 있고, 상대 별점은 읽기 전용이다.
- 자금 배지: 자금 탭 입력값과 후보의 가격·단지 지역으로 계산해 "자금 가능 · 여유 X" 또는 "X 부족"을 표시한다.
- **AI 비교 정리(선택)**: 후보가 2개 이상일 때만 보인다.
  - 후보, 임장, 자금 계산 결과를 텍스트로 묶어 Claude API로 보낸다. 호출은 Edge Function을 거쳐 키를 숨긴다.
  - 프롬프트 요구사항은 프로토타입의 `aiCompare` 함수를 따른다. 후보별 요약, 비교, 엇갈리는 지점과 질문, 계약 전 확인사항을 700자 안팎 평문으로 받는다.
  - 스트리밍으로 보여주고 멈추기 버튼을 둔다.

### 2.6 자금·대출
- 모드: 매매 / 전세 토글.
- 입력값(가정 단위로 1개 문서, 두 사람이 공유하고 함께 수정):
  - 소득: 신랑·신부 세전 연봉
  - 가용자산: 신랑, 신부, 양가 지원, 기타
  - 부채: 연간 원리금 상환액, 부채 잔액
  - 조건: 무주택(기본 참), 생애최초(기본 참), 2년 내 출산, 전용 85㎡ 초과, 생애최초 취득세 감면 반영(기본 거짓)
  - 금리(기본 4.2%), 만기(30/40년), 스트레스 금리 수동값(비우면 자동), 이사·기타 비용(기본 300만)
  - 테스트용 가격과 지역. 단지 칩을 누르면 해당 단지의 최신 시세와 지역이 채워진다. 매매 모드면 매매 시세, 전세 모드면 전세 시세를 쓴다.
- 입력은 0.9초 디바운스 후 저장한다. 상대의 변경은 실시간으로 반영하되, 내가 입력 중일 때는 덮어쓰지 않는다.
- 출력:
  - 판정 박스(가능/부족, 여유·부족액, 적용 대출과 월 상환액)
  - 은행 주담대 한도 3요소 표. 가장 작은 값에 "적용" 표시를 붙인다.
  - 정책대출 자격 목록. 탈락 사유를 함께 보여준다.
  - 필요 현금 내역표
  - 최대 매수 가능가: 규제지역, 비규제 수도권, 지방 세 가지

### 2.7 정책
- `policy_snapshot` 테이블의 최신 행을 보여준다.
  - 헤드라인
  - 항목 카드: 태그, 날짜, 제목, 요약, "우리에게" 영향, 출처 링크
- "우리 관심 단지의 규제 여부" 목록을 보여준다.
- 공식 창구 링크: 기금e든든, 한국주택금융공사, 금융위원회, 국토교통부.
- 관리자(가정 생성자 또는 별도 admin 플래그)만 정책 스냅샷을 수정할 수 있게 한다. 1단계에서는 SQL seed로만 갱신해도 된다.

---

## 3. 데이터 모델 (Supabase / Postgres)

```sql
-- 가정
create table households (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique not null,          -- 6자리
  move_in text,                               -- 'YYYY-MM'
  created_at timestamptz default now()
);

create table household_members (
  household_id uuid references households on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text check (role in ('groom','bride')) not null,
  nick text check (char_length(nick) <= 12),
  joined_at timestamptz default now(),
  primary key (household_id, user_id),
  unique (household_id, role)
);
-- 한 사용자는 한 가정에만 속한다
create unique index one_household_per_user on household_members(user_id);

create table complexes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households on delete cascade not null,
  name text not null, region text, reg_override text check (reg_override in ('yes','no')),
  area text, meta text, commute text, memo text,
  created_by uuid references auth.users, created_at timestamptz default now()
);

create table price_records (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid references complexes on delete cascade not null,
  household_id uuid references households on delete cascade not null,
  date date not null, type text not null, price_manwon int not null check (price_manwon > 0),
  floor text, created_by uuid references auth.users, created_at timestamptz default now()
);

create table visits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households on delete cascade not null,
  complex_id uuid references complexes on delete set null,
  complex_name text,                          -- 단지 삭제 대비
  date date not null,
  ratings jsonb default '{}',                 -- {traffic,noise,light,manage,life}: 0~5
  commute_groom int, commute_bride int,
  pros text, cons text, memo text,
  created_by uuid references auth.users, created_at timestamptz default now()
);

create table candidates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households on delete cascade not null,
  complex_id uuid references complexes on delete set null,
  deal_type text check (deal_type in ('매매','전세')) default '매매',
  status text default '관심', unit text, area text, price_manwon int, memo text,
  created_by uuid references auth.users, created_at timestamptz default now()
);

create table candidate_scores (
  candidate_id uuid references candidates on delete cascade,
  user_id uuid references auth.users on delete cascade,
  score int check (score between 0 and 5),
  primary key (candidate_id, user_id)
);

create table finances (
  household_id uuid primary key references households on delete cascade,
  data jsonb not null default '{}',          -- 2.6 입력값 전부
  updated_by uuid references auth.users, updated_at timestamptz default now()
);

create table policy_snapshot (
  id serial primary key,
  updated_at date not null,
  headline text,
  items jsonb not null,                       -- [{date,tag,title,summary,impact,source,url}]
  params jsonb not null,                      -- 계산 파라미터
  regulated jsonb not null                    -- ["서울 *","경기 과천시",...]
);
```

### RLS 원칙
- `is_member(hid)` 헬퍼 함수를 만든다. `security definer`로, `household_members`에 `auth.uid()`가 있는지 확인한다.
- 가정 소속 테이블은 전부 `using (is_member(household_id))`로 읽기·쓰기를 허용한다.
- `candidate_scores`는 읽기를 가정 구성원 전체에 허용하고, 쓰기는 `user_id = auth.uid()`인 행만 허용한다.
- 초대코드 합류는 RPC `join_household(code, nick)`로 처리한다. `security definer`로 만들고, 정원 2명 초과와 역할 중복을 서버에서 막는다. 클라이언트가 `households`를 코드로 직접 조회하지 못하게 한다.
- `policy_snapshot`은 로그인 사용자 전체가 읽을 수 있고, 쓰기는 service role만 한다.
- 테스트: 가정 A 사용자로 로그인했을 때 가정 B의 모든 테이블 조회 결과가 0건이어야 한다.

---

## 4. 계산 로직

단위는 모두 **만원**이다. 파라미터는 `policy_snapshot.params`를 우선 쓰고, 없으면 아래 기본값을 쓴다. 기본값은 `03_policy_snapshot.json`에도 들어 있다.

### 4.1 지역 판정
- **수도권**: 지역 문자열이 `서울`, `경기`, `인천`으로 시작하면 수도권이다.
- **규제지역**:
  - `reg_override`가 `yes`면 규제지역, `no`면 비규제로 계산한다.
  - 그 외에는 `regulated` 목록과 대조한다. `*`로 끝나는 항목은 접두어 일치, 나머지는 완전 일치로 판정한다.
- **한도 적용 대상**: 수도권이거나 규제지역이면 "수도권·규제"로 취급한다. 주택가격별 한도와 스트레스 3.0%p가 여기에 적용된다.

### 4.2 매매 (`calcBuy`)
1. 부부합산 소득 `inc`와 맞벌이 여부 `dual`(두 사람 소득이 모두 0보다 큼)을 구한다.
2. 가용자산 `cash` = 신랑 + 신부 + 양가 지원 + 기타.
3. 순자산 `net` = cash − 부채 잔액.
4. LTV를 정한다.

   | 구분 | 일반 | 생애최초 |
   |---|---|---|
   | 규제지역 | 40% | 70% |
   | 비규제 수도권 | 70% | 70% |
   | 지방 | 70% | 80% |

5. 주택가격별 한도(수도권·규제만): 15억 이하 6억, 25억 이하 4억, 그 초과 2억.
6. 만기: 수도권·규제는 최대 30년이다.
7. DSR 한도를 구한다.
   - 스트레스 금리는 수도권·규제면 3.0, 지방이면 0.75다. 사용자가 수동으로 넣은 값이 있으면 그 값을 쓴다.
   - 연간 원리금 계수: `annualFactor(r, y) = 12 · (r/12) / (1 − (1 + r/12)^(−12y))`. 금리 r은 %를 100으로 나눈 값이다.
   - `dsrAmt = max(0, inc × 40% − 기존 연간 원리금) / annualFactor(금리 + 스트레스, 만기)`
8. 은행 주담대 = min(LTV 금액, 한도, DSR 금액). 가장 작은 값을 "적용"으로 표시한다.
   - 무주택이 아니고 수도권·규제면 0으로 두고 경고를 띄운다. 이 계산기는 무주택 기준이다.
9. 정책대출 자격을 판정한다.

   | 상품 | 요건 | 한도 |
   |---|---|---|
   | 신생아 특례 디딤돌 | 2년 내 출산, 소득 ≤ 1.3억(맞벌이 2억), 주택가격 ≤ 9억, 85㎡ 이하, 무주택 | min(4억, 가격 × 70%, 가격별 한도) |
   | 신혼 디딤돌 | 소득 ≤ 8,500만, 주택가격 ≤ 6억, 순자산 ≤ 5.11억, 85㎡ 이하, 무주택 | min(3.2억, 가격 × 70%, 가격별 한도) |
   | 보금자리론 | 소득 ≤ 7,000만, 주택가격 ≤ 6억 | min(3.6억(생애최초 4.2억), 가격 × min(70%, LTV), 가격별 한도) |

10. 최적 대출 = 은행 주담대와 자격 있는 정책대출 중 최댓값.
11. 부대비용을 더한다.
    - **취득세**
      - 세율: 6억 이하 1%, 6~9억 `(가격(억) × 2/3 − 3)%`(소수 둘째 자리), 9억 초과 3%
      - 지방교육세는 취득세의 10%, 농특세는 85㎡ 초과일 때 가격의 0.2%
      - 생애최초 감면을 켜면 12억 이하에서 최대 200만 원을 차감한다
    - **중개보수 상한**
      - 5천 미만 0.6%(최대 25만), 2억 미만 0.5%(최대 80만)
      - 9억 미만 0.4%, 12억 미만 0.5%, 15억 미만 0.6%, 그 이상 0.7%
    - **기타**: 가격 × 0.2% + 이사·기타 비용(기본 300만)
12. 필요 현금 = 가격 − 최적 대출 + 부대비용. 여유(gap) = cash − 필요 현금.
13. 월 상환액 = 최적 대출 × annualFactor(입력 금리, 만기) / 12. 스트레스 금리는 넣지 않는다.

### 4.3 전세 (`calcRent`)
- 신혼부부 버팀목: 소득 ≤ 7,500만, 순자산 ≤ 3.45억. 한도는 min(수도권 3억 / 지방 2억, 보증금 × 80%).
- 신생아 특례 버팀목: 2년 내 출산, 소득 ≤ 1.3억(맞벌이 2억), 수도권이면 보증금 ≤ 5억. 한도는 min(2.4억, 보증금 × 80%).
- 은행 전세대출: min(보증금 × 80%, 5억).
- 중개보수 상한:
  - 5천 미만 0.5%(최대 20만), 1억 미만 0.4%(최대 30만)
  - 6억 미만 0.3%, 12억 미만 0.4%, 15억 미만 0.5%, 그 이상 0.6%
- 필요 현금 = 보증금 − 최적 대출 + 중개보수 + 이사·기타.
- 월 이자 = 최적 대출 × 금리 / 12.

### 4.4 최대 매수 가능가 (`maxAfford`)
5,000만부터 40억까지 500만 단위로 올려가며 gap ≥ 0인 가장 큰 가격을 찾는다. 가격별 한도 때문에 필요 현금이 계단형으로 변하므로 이분탐색 대신 선형 탐색을 쓴다. 성능이 문제면 메모이즈한다.

### 4.5 단위 테스트 케이스

프로토타입 로직으로 산출한 값이다. 소수는 반올림했고, 허용 오차는 ±1(만원)이다.

**공통 입력**: 신랑 6,000 / 신부 5,000 소득, 신랑 15,000 / 신부 10,000 / 양가 5,000 자산, 부채 0, 무주택, 생애최초, 출산 없음, 85㎡ 이하, 금리 4.2%, 30년.

| 가격 | 지역 | LTV% | LTV액 | 한도 | DSR액 | 은행대출 | 적용 | 취득세계 | 중개 | 기타 | 필요현금 | 여유 | 월상환 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 90,000 | 경기 용인시 수지구 | 70 | 63,000 | 60,000 | 54,018 | 54,018 | DSR | 2,970 | 450 | 480 | 39,882 | −9,882 | 264 |
| 70,000 | 경기 고양시 | 70 | 49,000 | 60,000 | 54,018 | 49,000 | LTV | 1,286 | 280 | 440 | 23,006 | 6,994 | 240 |
| 55,000 | 경기 성남시 분당구 | 70 | 38,500 | 60,000 | 54,018 | 38,500 | LTV | 605 | 220 | 410 | 17,735 | 12,265 | 188 |
| 180,000 | 서울 강남구 | 70 | 126,000 | 40,000 | 54,018 | 40,000 | 주택가격별 한도 | 5,940 | 1,260 | 660 | 147,860 | −117,860 | 196 |

**추가 케이스**

1. 최대 매수가(공통 입력): 규제지역 81,000, 비규제 수도권 81,000, 지방 94,500.
2. 소득을 신랑 5,000 / 신부 3,000으로 바꾸고 2년 내 출산을 켠 뒤 55,000(분당)을 계산하면 다음과 같다.
   - 신생아 특례: 대상, 38,500
   - 신혼 디딤돌: 대상, 32,000
   - 보금자리론: 탈락(소득 초과)
   - 최적 대출: 38,500. 은행과 금액이 같으므로 은행 주담대가 유지된다.
3. 전세 40,000(분당), 소득 4,000 / 3,000, 공통 자산:
   - 최적 대출: 은행 전세대출 32,000(버팀목 30,000보다 큼)
   - 중개 120, 필요 현금 8,420, 여유 21,580
4. 취득세:
   - 60,000 → 660(1%)
   - 75,000 → 1,650(2%)
   - 100,000에 85㎡ 초과 → 3,500(3%)
   - 50,000에 생애최초 감면 → 350

---

## 5. 화면·디자인

- **탭 6개**: 홈, 시세, 임장, 후보, 자금, 정책. 모바일에서는 하단 고정 탭바를 쓰고 safe-area를 반영한다.
- **색 토큰**(라이트 기준, 다크 모드 대응 필수):
  - 배경 `#EDF0EA`, 카드 `#FFFFFF`, 보조면 `#F5F7F2`, 글자 `#1C2733`, 보조글자 `#5B6773`, 선 `#D3DACF`
  - 포인트(열쇠색) `#E2A31F`
  - 신랑 `#2D6CAB`, 신부 `#B8406A`
  - 가능 `#2B7A4B`, 부족 `#B23A2C`
- **폰트**: 본문 IBM Plex Sans KR, 헤더의 커플 이름만 Gowun Batang. 숫자는 tabular-nums.
- **색 사용 규칙**: 신랑 파랑, 신부 분홍은 "누가 기록했나"를 나타내는 정보로만 쓴다. 장식으로 쓰지 않는다.
- **입력 폼**: 하단 시트(모바일) 또는 가운데 모달(데스크톱) 형태. Esc와 바깥 클릭으로 닫힌다.
- **접근성**: 키보드 포커스를 표시하고, 버튼에 aria-label을 달고, reduced-motion을 존중한다.
- **문구 톤**: 존댓말 평서형("저장했어요"). 오류 메시지는 무엇이 잘못됐고 어떻게 고치는지 말한다.

## 6. 완료 기준 체크리스트

- [ ] 두 계정으로 가정 만들기와 초대코드 합류가 된다. 세 번째 계정은 거절된다.
- [ ] 한 사람이 저장하면 다른 사람 화면에 새로고침 없이 반영된다.
- [ ] 다른 가정의 데이터가 API로도 조회되지 않는다(RLS 테스트 통과).
- [ ] 4.5의 모든 테스트 케이스가 Vitest로 통과한다.
- [ ] 후보 카드의 자금 배지가 자금 탭 계산과 일치한다.
- [ ] 정책 수치를 `policy_snapshot`에서 바꾸면 재배포 없이 계산에 반영된다.
- [ ] 360px 폭 모바일에서 가로 스크롤이 생기지 않는다. 다크 모드에서 대비가 충분하다.
- [ ] Netlify에 배포되고 README대로 새 환경에서 재현된다.
- [ ] API 키(Supabase service role, 공공데이터, Claude)가 클라이언트 번들에 없다.

## 7. 주의사항

- 정책 수치는 2026-09-23 기준 공개 자료와 언론 보도를 바탕으로 정리한 것이다.
  - 출처끼리 다른 값도 있다. 예를 들어 신혼 버팀목 수도권 한도는 2.5억과 3억이 섞여 나온다.
  - 기금e든든과 은행 공지로 최종 확인한 뒤 seed를 갱신해야 한다.
- 규제지역 지정, 토지거래허가구역 기한(10·15 지정분은 2026년 말까지), 신혼부부 소득 심사 완화(10월 시행 예정)는 바뀔 수 있다. 정책 탭의 날짜 표시를 유지한다.
- 계산은 은행 심사 전 가늠용이다.
  - 디딤돌의 방공제, 은행별 DSR 산정 차이, 혼합·주기형 금리의 스트레스 반영률 차이는 반영하지 않았다.
