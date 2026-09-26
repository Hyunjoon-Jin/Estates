# 직접 해야 할 일

코드는 준비됐습니다. 아래는 계정·결제·키·정책 확인처럼 저장소 밖에서 사람이 해야 하는 일입니다.
위에서부터 순서대로 하면 됩니다. 괄호 안 시간은 대략적인 소요 시간입니다.

## 1. Supabase 프로젝트 (완료, 2026-09-25)

- [x] **프로젝트:** `Estates`, 서울 리전 (Reference ID `xmafodhhfbzhzhjjkorg`)
- [x] **DB:** 마이그레이션 5개, 정책 seed 1행, Realtime 테이블 9개 적용
- [x] **실제 DB 격리 테스트 통과:** 트랜잭션 안에서 돌리고 롤백해서 테스트 데이터는 남지 않았습니다.
- [x] **보안 점검:** 남은 경고는 가정 만들기·합류·역할 바꾸기 RPC 3개뿐입니다. 명세상 서버에서 권한 검사를 하려고 일부러 연 함수입니다.
- [x] **Edge Function:** `ai-compare` 배포 완료. `ANTHROPIC_API_KEY`를 넣기 전까지는 "설정되지 않았어요" 안내가 뜹니다.
- [ ] **(선택) 원격 테스트용 키:** `npm run test:rls`를 돌리려면 **Project Settings → API Keys**의 `service_role` 키(또는 `sb_secret_` 키)를 로컬 `.env.test`에만 넣으세요. 채팅·커밋·Netlify 어디에도 붙여넣지 마세요.

앱 환경변수에 넣을 값 (공개돼도 되는 값입니다):

```
VITE_SUPABASE_URL=https://xmafodhhfbzhzhjjkorg.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_YtOruMhOr1Z4kAaj_GsXTw_slWyNDIQ
```

## 2. 로그인 메일 (필수, 20분)

매직링크 로그인이 기본이라 메일이 실제로 가야 합니다.

- [ ] **커스텀 SMTP 연결:** **Authentication → Emails → SMTP Settings**에서 켜세요.
  - Supabase 기본 메일 발송은 시험용이라 받는 주소와 발송량에 제한이 있습니다. 배우자 계정 메일이 안 올 수 있습니다.
  - 예: [Resend](https://resend.com)(무료 한도 있음). 가입 → 도메인 인증 또는 테스트 주소 → SMTP 정보 입력.
- [ ] **메일 문구 한국어로 바꾸기:** **Authentication → Emails → Templates → Magic Link**
  - 제목 예: `우리 신혼집 로그인 링크`
  - 본문에 `{{ .ConfirmationURL }}` 링크를 남겨두세요.
- [ ] **돌아올 주소 등록:** **Authentication → URL Configuration**
  - Site URL: Netlify 주소 (4번에서 생김)
  - Redirect URLs: `http://localhost:5173/**`, `https://<netlify-주소>/**`

## 3. 카카오·구글 로그인 (선택, 각 20~30분)

- [ ] **카카오**
  - [developers.kakao.com](https://developers.kakao.com) → 애플리케이션 추가 → **카카오 로그인 활성화**
  - Redirect URI에 `https://xmafodhhfbzhzhjjkorg.supabase.co/auth/v1/callback`를 등록합니다.
  - 동의항목: 닉네임. 이메일은 비즈앱 전환이 필요할 수 있습니다.
  - REST API 키와 Client Secret을 Supabase **Authentication → Providers → Kakao**에 넣습니다. 이메일 동의를 못 받으면 "이메일 없는 사용자 허용" 옵션을 켭니다.
- [ ] **구글**
  - Google Cloud Console → OAuth 동의 화면 → 사용자 인증 정보 → OAuth 클라이언트(웹)
  - 승인된 리디렉션 URI는 카카오와 같은 `…/auth/v1/callback`입니다.
  - 클라이언트 ID와 Secret을 Supabase에 넣습니다.
- [ ] **버튼 켜기:** 켠 provider만 Netlify 환경변수에 `VITE_OAUTH_KAKAO=true` 또는 `VITE_OAUTH_GOOGLE=true`를 넣습니다.

## 4. Netlify 배포 (필수, 10분)

- [ ] **사이트 연결:** [app.netlify.com](https://app.netlify.com) → **Add new site → Import from Git** → `hyunjoon-jin/estates` 저장소
  - 브랜치는 PR을 합친 뒤 `main`, 지금 바로 보려면 `claude/new-session-7nv3xv`
  - 빌드 설정은 `netlify.toml`에 있어서 따로 입력할 필요가 없습니다.
- [ ] **환경변수:** **Site configuration → Environment variables**에 1번 끝의 두 값을 그대로 넣습니다.
  - 여기에 service_role 키를 넣으면 안 됩니다. `VITE_`가 붙은 값은 누구나 볼 수 있는 번들에 들어갑니다.
- [ ] **주소 등록:** 배포된 주소를 2번의 Site URL과 Redirect URLs에 넣습니다.
- [ ] **(선택) 사이트 이름:** 정하면 알려주세요. 예: `our-newlywed-home`

## 5. AI 비교 정리 (선택, 10분)

- [ ] **API 키 발급:** [console.anthropic.com](https://console.anthropic.com) → API Keys → 키 발급, 결제 수단 등록
  - 월 사용 한도(Spend limit)를 낮게 걸어두면 안전합니다.
- [ ] **키 전달:** 둘 중 하나로 넣으세요.
  - 제가 넣기: 키를 채팅에 붙이지 말고, Supabase **Edge Functions → Secrets**에 `ANTHROPIC_API_KEY`로 직접 추가한 뒤 알려주세요.
  - 직접 넣기: `npx supabase secrets set ANTHROPIC_API_KEY=...`
- [ ] **모델 정하기:** 기본은 `claude-opus-5`입니다. 비용을 줄이려면 Secrets에 `ANTHROPIC_MODEL=claude-sonnet-5`를 추가하세요. 700자 요약이라 품질 차이는 크지 않을 가능성이 높습니다.

## 5-1. 국토부 실거래가 연동 (필수, 15분 + 승인 대기)

코드와 서버 함수(`molit-trades`)는 배포돼 있습니다. 인증키만 넣으면 동작합니다.

- [ ] **활용신청:** [공공데이터포털](https://www.data.go.kr) 로그인 → 아래 두 API를 검색해 각각 **활용신청** (개발계정은 보통 바로 또는 1~2시간 안에 승인)
  - `국토교통부_아파트 매매 실거래가 자료`
  - `국토교통부_아파트 전월세 실거래가 자료`
- [ ] **인증키 복사:** 마이페이지 → 개발계정 → 신청한 API → **일반 인증키 (Decoding)**. Encoding 키를 넣어도 동작합니다.
- [ ] **Supabase에 넣기:** [Edge Functions → Secrets](https://supabase.com/dashboard/project/xmafodhhfbzhzhjjkorg/functions/secrets)에 이름 `MOLIT_SERVICE_KEY`, 값에 인증키를 넣습니다. 채팅에 붙이지 마세요.
- [ ] **확인:** 앱 시세 탭 → 단지 → "실거래 불러오기". 인증키 오류가 뜨면 승인이 아직이거나 키가 틀린 것입니다.
- 참고
  - 하루 조회 한도는 개발계정 기준 API당 1,000회 안팎입니다. 같은 지역·달은 서버에 캐시해서(이번 달·지난달 6시간, 그 전 7일) 실제 호출은 훨씬 적습니다.
  - **화성시 4개 구(2026-02 신설), 부천시 구, 인천, 지방**은 시군구 코드가 자동으로 안 채워집니다. 단지 상세에서 5자리 코드를 한 번 넣어주세요([법정동코드 조회](https://www.code.go.kr/stdcode/regCodeL.do), 법정동코드 앞 5자리).
  - 호가와 KB시세는 공식 공개 API가 없어 자동으로 못 가져옵니다. 단지 상세의 네이버부동산·호갱노노·KB부동산 링크로 확인하고 직접 기록하세요.

## 6. 정책 수치 확인 (필수, 30분, 계약 전 재확인)

명세 7장대로 seed 수치는 공개 자료 요약이라 출처끼리 다른 값이 있습니다. 아래를 공식 창구에서 확인하고 다른 값이 있으면 알려주세요. 새 정책 행을 넣어 갱신하겠습니다(재배포 불필요).

- [ ] **신혼부부 버팀목 수도권 한도:** seed는 3억, 일부 자료는 2.5억 → [기금e든든](https://enhuf.molit.go.kr/)
- [ ] **신혼 디딤돌:** 소득 8,500만, 순자산 5.11억, 한도 3.2억 → 기금e든든
- [ ] **보금자리론:** 소득 7,000만, 한도 3.6억(생애최초 4.2억) → [한국주택금융공사](https://www.hf.go.kr/)
- [ ] **10월 시행 예정 신혼부부 소득 심사 완화:** "한 사람 7천만 이하" 조건이 어느 상품에 붙는지 확인. 확인되면 계산 로직에 반영이 필요할 수 있습니다.
- [ ] **토지거래허가구역 기한과 규제지역 목록 변동:** [국토교통부](https://www.molit.go.kr/) 보도자료
- [ ] **은행 주담대 금리 시세:** 기본 4.2%. 거래 은행 앱에서 사전 조회한 금리로 자금 탭 금리를 바꿔 보세요.

## 7. 두 사람 실사용 점검 (필수, 20분)

배포가 끝나면 휴대폰 두 대로 확인합니다.

- [ ] **가정 만들기:** A가 로그인 → 가정 만들기 → 홈 헤더의 초대코드 복사
- [ ] **합류:** B가 로그인 → 초대코드로 합류 → 역할이 반대로 자동 배정되는지
- [ ] **실시간 반영:** A가 단지를 추가하면 B 화면에 새로고침 없이 뜨는지
- [ ] **동시 입력:** 둘이 동시에 자금 탭의 다른 칸을 고쳐도 서로 지워지지 않는지
- [ ] **정원 초과 거절:** 세 번째 계정으로 같은 코드를 넣으면 "이미 두 사람이 등록된 가정"이 뜨는지
- [ ] **홈 화면 추가:** 아이폰 Safari 공유 → "홈 화면에 추가"로 앱처럼 쓸 수 있습니다

## 8. 나중에 정할 것

- [ ] **개인 도메인:** Netlify **Domain management**에서 연결
- [ ] **정책 스냅샷 편집 권한:** 앱 안 관리자 화면을 만들지, 지금처럼 SQL로만 갱신할지
