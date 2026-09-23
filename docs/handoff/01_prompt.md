# Claude Code 요청 프롬프트

> 이 폴더(`01_prompt.md`, `02_spec.md`, `03_policy_snapshot.json`, `04_prototype.html`)를 빈 프로젝트 루트에 넣은 뒤, 아래 내용을 Claude Code에 그대로 붙여넣으세요.

---

신혼부부가 함께 쓰는 "신혼집 구하기" 웹앱을 만들어줘.

## 참고 자료 (먼저 전부 읽어줘)
- `02_spec.md`: 기능, 데이터 모델, 계산 공식, 화면 구성, 완료 기준을 담은 상세 명세. **이 문서가 기준이야.**
- `03_policy_snapshot.json`: 2026-09-23 기준 부동산·대출 정책 요약과 계산 파라미터. 앱 초기 데이터(seed)로 써줘.
- `04_prototype.html`: claude.ai에서 먼저 만든 단일 HTML 프로토타입이야.
  - 화면 흐름, 문구, 계산 로직(`calcBuy`, `calcRent`, `maxAfford`, `acqTax`, `brokerBuy`, `brokerRent`)은 여기서 가져와.
  - 저장소 코드(`claude.use("db")`, `claude.use("user")`, `claude.use("sample")`)는 claude.ai 전용이니 **가져오지 말고** Supabase로 바꿔줘.

## 기술 스택
- 프론트: React + Vite + TypeScript. 스타일은 CSS 변수 기반(프로토타입의 토큰 재사용). 모바일 우선.
- 백엔드: Supabase (Auth, Postgres, Row Level Security, 필요 시 Edge Functions)
- 배포: Netlify
- 테스트: Vitest (계산 로직 단위 테스트 필수)

## 작업 순서
1. 계획 먼저: 폴더 구조, DB 스키마(SQL 마이그레이션), 화면 목록을 짧게 제안하고 내 확인을 받은 다음 코딩해줘.
2. 계산 로직 분리: `src/lib/finance/`로 떼어내고 `02_spec.md`의 테스트 케이스를 Vitest로 먼저 통과시켜줘.
3. Supabase 연결:
   - 마이그레이션 SQL과 RLS 정책을 작성해줘. 같은 가정(household) 구성원만 읽고 쓸 수 있어야 해.
   - `.env.example`을 만들어줘. 키는 절대 커밋하지 마.
4. 기능 구현:
   - 인증 → 가정 만들기/초대코드 합류 → 홈 → 시세 → 임장 → 후보 → 자금 → 정책 순서로 만들어줘.
   - 각 단계가 끝날 때마다 빌드가 되는 상태를 유지해줘.
5. 실시간 동기화: 두 사람이 동시에 봐도 반영되도록 Supabase Realtime을 구독해줘.
6. 마무리:
   - README에 로컬 실행, Supabase 설정, Netlify 배포 방법을 적어줘.
   - `02_spec.md`의 완료 기준 체크리스트를 하나씩 확인한 결과를 보고해줘.

## 지켜줘야 할 것
- 금액 입력·저장 단위는 **만원**, 표시는 "7억 2,000만원" 형식.
- 정책 수치(LTV, 한도, 스트레스 금리, 정책대출 요건)는 코드에 박지 말고 `policy_snapshot` 테이블의 `params`에서 읽어줘. 코드에는 fallback 기본값만 둬.
- 모든 계산 결과 화면에 "은행 사전심사 전 가늠용" 안내를 붙여줘.
- 개인 재무정보가 담기니 RLS를 빠뜨리지 말고, 테스트로 다른 가정 데이터가 안 보이는지 확인해줘.
- 모르는 요구사항은 추측하지 말고 물어봐줘.
