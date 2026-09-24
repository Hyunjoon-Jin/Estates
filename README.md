# 우리 신혼집

신혼부부 두 사람이 시세, 임장, 계약 후보, 자금·대출 계산을 한곳에서 같이 관리하는 웹앱입니다.
기준 명세는 [`docs/handoff/02_spec.md`](docs/handoff/02_spec.md)이고, 원본 프로토타입과 정책 스냅샷도 `docs/handoff/`에 있습니다.

- 프론트: React 18, Vite 5, TypeScript. 스타일은 CSS 변수 토큰(`src/styles/app.css`)이고 다크 모드를 지원합니다.
- 백엔드: Supabase(Auth, Postgres, RLS, Realtime, Edge Functions)
- 배포: Netlify
- 테스트
  - Vitest: 계산 로직
  - SQL: RLS 격리 검증
  - Playwright: 목업 백엔드로 도는 화면 스모크 테스트

> 계정·키·배포처럼 직접 해야 할 일은 [`docs/OWNER_TODO.md`](docs/OWNER_TODO.md)에 순서대로 정리돼 있습니다.

> 모든 계산 결과는 **은행 사전심사 전 가늠용**입니다. 정책 수치는 2026-09-23 기준이라 바뀔 수 있습니다.

## 폴더 구조

```
src/lib/finance/          계산 로직 (순수 함수, 명세 4장) + __tests__ (명세 4.5)
src/lib/                  Supabase 클라이언트, 타입, 오류 문구, 도메인 헬퍼
src/state/AppData.tsx     가정 데이터 로드 + Realtime 구독
src/components/, screens/ 화면
supabase/migrations/      스키마, RLS, RPC, Realtime
supabase/seed.sql         policy_snapshot 초기 데이터 (03_policy_snapshot.json)
supabase/functions/       ai-compare (후보 비교 정리, Claude API)
supabase/tests/           rls_isolation.sql (psql 로 실행하는 RLS 테스트)
tests/rls/                원격 프로젝트 대상 RLS 통합 테스트 (Vitest)
tests/e2e/smoke.mjs       목업 Supabase 로 띄우는 화면 스모크 테스트
```

## 로컬 실행

```bash
npm install
cp .env.example .env        # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 채우기
npm run dev                 # http://localhost:5173
npm test                    # 계산 로직 단위 테스트
npm run build
```

`.env`가 비어 있으면 앱은 설정 안내 화면만 보여줍니다.

## Supabase 설정

1. [supabase.com](https://supabase.com)에서 프로젝트를 만듭니다. 지역은 서울(`ap-northeast-2`)을 권장합니다.
2. 마이그레이션과 seed를 적용합니다.
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push                 # supabase/migrations/*
   psql "$DB_URL" -f supabase/seed.sql   # 정책 스냅샷 1행
   ```
   CLI 없이 하려면 대시보드 SQL Editor에 `supabase/migrations/`의 파일을 이름 순서대로 붙여 실행한 뒤 `seed.sql`을 실행합니다.
3. **Authentication → URL Configuration**
   - Site URL을 배포 주소(예: `https://<site>.netlify.app`)로 설정합니다.
   - Redirect URLs에 `http://localhost:5173/**`와 배포 주소를 추가합니다. 매직링크는 이 주소로 돌아옵니다.
4. (선택) 카카오·구글 로그인
   - **Authentication → Providers**에서 각 provider를 켜고 앱 키를 넣습니다.
   - 그다음 `.env`(또는 Netlify 환경변수)에 `VITE_OAUTH_KAKAO=true`, `VITE_OAUTH_GOOGLE=true`를 넣습니다.
5. (선택) AI 비교 정리
   ```bash
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   # 모델을 바꾸려면: npx supabase secrets set ANTHROPIC_MODEL=<model-id>  (기본 claude-opus-5)
   npx supabase functions deploy ai-compare
   ```
   키가 없으면 버튼을 눌렀을 때 "아직 설정되지 않았어요" 안내가 나옵니다.
6. **API 키 → anon(publishable) 키와 Project URL**을 `.env`에 넣습니다. service role 키는 어디에도 `VITE_`로 넣지 않습니다.

### 정책 수치 갱신

정책 수치는 코드에 박혀 있지 않습니다. 앱은 `policy_snapshot`의 최신 행(`updated_at`, `id` 순)의 `params`와 `regulated`를 읽고, 코드에는 fallback 기본값만 있습니다(`src/lib/finance/params.ts`). 수치를 바꾸려면 새 행을 넣으면 됩니다. 쓰기는 service role만 할 수 있으니 SQL Editor에서 실행하세요.

```sql
insert into policy_snapshot (updated_at, headline, items, params, regulated)
select current_date, headline, items,
       jsonb_set(params, '{ltv,reg}', '50'),   -- 예: 규제지역 LTV 50%
       regulated
from policy_snapshot order by updated_at desc, id desc limit 1;
```

열려 있는 화면은 Realtime 또는 다음 포커스 때 새 값으로 다시 계산합니다. 재배포는 필요 없습니다.

## Netlify 배포

1. Netlify에서 **Add new site → Import from Git**으로 이 저장소를 연결합니다. 빌드 설정은 `netlify.toml`에 있습니다(`npm run build`, `dist`, SPA 리다이렉트).
2. **Site configuration → Environment variables**에 다음 값을 넣습니다.
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - (선택) `VITE_OAUTH_KAKAO`, `VITE_OAUTH_GOOGLE`
3. 배포한 뒤 사이트 주소를 Supabase의 Site URL과 Redirect URLs에 추가합니다(위 3번).

CLI로 하려면 이렇게 합니다.

```bash
npx netlify login && npx netlify init
npx netlify env:set VITE_SUPABASE_URL https://<ref>.supabase.co
npx netlify env:set VITE_SUPABASE_ANON_KEY <anon-key>
npx netlify deploy --build --prod
```

## 테스트

| 명령 | 내용 |
|---|---|
| `npm test` | 명세 4.5 계산 케이스 전부 (허용 오차 ±1만원), 파라미터 주입, 기본값 |
| `psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_isolation.sql` | 가정 A/B 격리, 3번째 계정 거절, 남의 별점 수정 불가, 정책 쓰기 거부, anon 차단. 한 트랜잭션 안에서 돌고 롤백합니다 |
| `npm run test:rls` | 실제 프로젝트에 테스트 계정 4개를 만들어 API로 격리를 확인한 뒤 지웁니다. `.env.test`에 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`를 넣어야 합니다(커밋 금지) |
| `npm run test:smoke` | 목업 Supabase로 7개 화면을 360px·라이트/다크로 띄워 가로 스크롤, 후보 배지와 자금 탭 일치, 디바운스 저장, 시트 Esc를 확인합니다. 스크린샷은 `tests/e2e/shots/`에 저장됩니다 |

## 보안 메모

- 가정 소속 테이블은 모두 RLS `is_member(household_id)`로 막혀 있습니다.
- 다른 가정의 단지 id를 참조하는 insert도 막힙니다.
- 가정 생성·합류·역할 교환은 `security definer` RPC로만 합니다. 클라이언트는 초대코드로 `households`를 조회할 수 없습니다.
- 클라이언트 번들에는 anon 키만 들어갑니다. service role, Claude API 키, 공공데이터 키는 서버 secret 또는 `.env.test`에만 둡니다.
- Realtime 삭제 이벤트는 필터를 적용할 수 없습니다. 그래서 다른 가정 행의 삭제 PK가 전달될 수 있지만, 앱은 그걸 받으면 자기 가정 데이터를 다시 읽기만 합니다(RLS로 내용은 보이지 않음).
