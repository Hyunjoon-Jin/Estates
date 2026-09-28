// 목업 Supabase 로 화면을 띄워 보는 스모크 테스트.
// 확인: 360px 가로 스크롤 없음(라이트·다크), 후보 자금 배지 = 자금 탭 판정, 예산 눈금자, 면책 문구.
// 실행: npm run test:smoke  (먼저 목업 URL 로 빌드한 dist 를 vite preview 로 띄운다)
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:4173';
const SB = 'http://mock.supabase.local';
const SHOTS = process.env.SMOKE_SHOTS ?? 'tests/e2e/shots';
mkdirSync(SHOTS, { recursive: true });

const UID = '11111111-1111-1111-1111-111111111111';
const UID2 = '22222222-2222-2222-2222-222222222222';
const HID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const snap = JSON.parse(readFileSync('docs/handoff/03_policy_snapshot.json', 'utf8'));
const now = new Date().toISOString();

const db = {
  households: [{ id: HID, invite_code: 'K7M2QX', move_in: '2027-03', created_by: UID, created_at: now }],
  household_members: [
    { household_id: HID, user_id: UID, role: 'groom', nick: '준', display_name: null },
    { household_id: HID, user_id: UID2, role: 'bride', nick: '민', display_name: null },
  ],
  complexes: [
    { id: 'c1', household_id: HID, name: '분당 파크뷰', region: '경기 성남시 분당구', reg_override: null, area: '84㎡', meta: '1,829세대 · 2004년', commute: '신랑 20분 / 신부 35분', memo: null, created_by: UID, created_at: now },
    { id: 'c2', household_id: HID, name: '일산 후곡마을', region: '경기 고양시', reg_override: null, area: '84㎡', meta: null, commute: null, memo: null, created_by: UID2, created_at: now },
    { id: 'c3', household_id: HID, name: '래미안대치팰리스', region: '서울 강남구', reg_override: null, area: '84㎡', meta: null, commute: null, memo: null, created_by: UID, created_at: now },
  ],
  price_records: [
    { id: 'p1', complex_id: 'c1', household_id: HID, date: '2026-07-01', type: '실거래', price_manwon: 53000, floor: '8층', created_by: UID },
    { id: 'p2', complex_id: 'c1', household_id: HID, date: '2026-09-01', type: '실거래', price_manwon: 55000, floor: '12층', created_by: UID2 },
    { id: 'p3', complex_id: 'c1', household_id: HID, date: '2026-09-10', type: '전세 실거래', price_manwon: 40000, floor: '3층', created_by: UID },
    { id: 'p4', complex_id: 'c2', household_id: HID, date: '2026-09-05', type: '호가', price_manwon: 70000, floor: null, created_by: UID2 },
  ],
  visits: [
    { id: 'v1', household_id: HID, complex_id: 'c1', complex_name: '분당 파크뷰', date: '2026-09-14', ratings: { traffic: 5, noise: 3, light: 4, manage: 4, life: 5 }, commute_groom: 20, commute_bride: 35, pros: '역까지 5분', cons: '주차 좁음', memo: null, created_by: UID, created_at: now },
    { id: 'v2', household_id: HID, complex_id: 'c2', complex_name: '일산 후곡마을', date: '2026-09-15', ratings: { traffic: 3, noise: 4 }, commute_groom: 50, commute_bride: 40, pros: '조용함', cons: null, memo: null, created_by: UID2, created_at: now },
  ],
  candidates: [
    { id: 'k1', household_id: HID, complex_id: 'c1', deal_type: '매매', status: '협상중', unit: '105동 1203호', area: '84㎡', price_manwon: 55000, memo: null, created_by: UID, created_at: now },
    { id: 'k2', household_id: HID, complex_id: 'c3', deal_type: '매매', status: '관심', unit: null, area: '84㎡', price_manwon: 180000, memo: null, created_by: UID2, created_at: now },
    { id: 'k3', household_id: HID, complex_id: 'c1', deal_type: '전세', status: '연락중', unit: null, area: '59㎡', price_manwon: 40000, memo: null, created_by: UID2, created_at: now },
  ],
  candidate_scores: [{ candidate_id: 'k1', user_id: UID, score: 4 }, { candidate_id: 'k1', user_id: UID2, score: 2 }],
  finances: [{ household_id: HID, data: { gIncome: 6000, bIncome: 5000, gCash: 15000, bCash: 10000, parents: 5000, testPrice: 55000, testRegion: '경기 성남시 분당구' }, updated_by: UID, updated_at: now }],
  policy_snapshot: [{ id: 1, updated_at: snap.updatedAt, headline: snap.headline, items: snap.items, params: snap.params, regulated: snap.regulated }],
};

const molitCalls = [];
const mk = (kind, date, floor, area, price, extra = {}) => ({ kind, name: '분당파크뷰', dong: '정자동', jibun: '1', sggCd: '41135', area, floor, date, price, monthlyRent: 0, buildYear: '2004', cancelled: false, key: `molit|${kind}|${date}|${floor}|${area}|${price}`, ...extra });
const MOLIT = [
  mk('trade', '2026-09-12', '15', 84.97, 56000),
  mk('trade', '2026-08-20', '3', 84.97, 53500),
  mk('trade', '2026-08-05', '9', 59.8, 42000),
  mk('trade', '2026-07-30', '11', 84.97, 55000, { cancelled: true }),
  mk('rent', '2026-09-01', '7', 84.97, 41000),
  mk('rent', '2026-08-11', '2', 84.97, 10000, { monthlyRent: 150 }),
  mk('trade', '2026-09-03', '8', 84.5, 61000, { name: '정자한솔마을' }),
  mk('trade', '2026-08-28', '12', 84.5, 60000, { name: '정자한솔마을' }),
];
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', exp: 4102444800 })}.sig`;
const session = {
  access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800,
  user: { id: UID, email: 'groom@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: now },
};

const fails = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} - ${msg}`); if (!ok) fails.push(msg); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function newPage(scheme) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, colorScheme: scheme, deviceScaleFactor: 2 });
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), ['sb-mock-auth-token', JSON.stringify(session)]);
  await ctx.route(`${SB}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const one = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname.startsWith('/auth/v1/user')) return json(session.user);
    if (url.pathname === '/functions/v1/molit-trades') {
      const b = req.postDataJSON();
      molitCalls.push(b);
      const q = (b.name ?? '').replace(/\s/g, '');
      const deals = MOLIT.filter((d) => d.kind === b.kind && (!q || d.name.includes(q) || q.includes(d.name)));
      if (b.mode === 'names') return json({ names: [{ name: '분당파크뷰', sggCd: '41135', dong: '정자동', count: 3, latestDate: '2026-09-12', latestPrice: 56000, areas: [85, 60] }], errors: [] });
      return json({ deals, total: deals.length, errors: [] });
    }
    const m = url.pathname.match(/^\/rest\/v1\/(rpc\/)?(\w+)/);
    if (!m) return route.fulfill({ status: 404, body: '' });
    if (m[1]) {
      if (m[2] === 'patch_finances') {
        const patch = req.postDataJSON().p_patch;
        const f = db.finances[0];
        f.data = Object.fromEntries(Object.entries({ ...f.data, ...patch }).filter(([, v]) => v !== null));
        return json(f);
      }
      return json(null);
    }
    let rows = db[m[2]] ?? [];
    for (const [k, v] of url.searchParams) {
      if (v.startsWith('eq.')) rows = rows.filter((r) => String(r[k]) === v.slice(3));
    }
    if (req.method() === 'POST' && db[m[2]]) {
      const body = [].concat(req.postDataJSON());
      const keys = new Set(db[m[2]].map((r) => r.source_key).filter(Boolean));
      if (body.some((r) => r.source_key && keys.has(r.source_key))) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: '23505' }) });
      const inserted = body.map((r, i) => ({ id: `new${db[m[2]].length}${i}`, ...r }));
      db[m[2]].push(...inserted);
      if ((req.headers()['prefer'] ?? '').includes('return=representation')) return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(one ? inserted[0] : inserted) });
      return route.fulfill({ status: 201, body: '' });
    }
    if (req.method() !== 'GET') return json(one ? rows[0] ?? null : rows);
    return json(one ? rows[0] ?? null : rows);
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fails.push(`page error: ${e.message}`));
  return page;
}

const ROUTES = ['/', '/price', '/deals', '/visit', '/cand', '/money', '/policy', '/settings'];

for (const scheme of ['light', 'dark']) {
  const page = await newPage(scheme);
  for (const r of ROUTES) {
    await page.goto(`${BASE}${r}`);
    await page.waitForSelector('nav.tabs', { timeout: 10000 });
    await page.waitForTimeout(250);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check(sw <= 360, `${scheme} ${r}: 360px 에서 가로 스크롤 없음 (scrollWidth ${sw})`);
    await page.screenshot({ path: `${SHOTS}/${scheme}${r === '/' ? '-home' : r.replace('/', '-')}.png`, fullPage: true });
  }
  await page.context().close();
}

const page = await newPage('light');
await page.goto(`${BASE}/`);
await page.waitForSelector('.ruler');
const legend = await page.textContent('.legend');
check(/규제지역 8\.1억까지/.test(legend) && /비규제 수도권 8\.1억까지/.test(legend), `눈금자: 규제·비규제 최대 8.1억 (${legend})`);
check((await page.locator('.ruler .tick').count()) === 2, '눈금자: 매매 후보 2개 세로선 (전세 제외)');
check(/D-\d+/.test(await page.textContent('.dday')), '헤더: 입주 목표 D-day');

await page.goto(`${BASE}/cand`);
await page.waitForSelector('.tag.ok');
const cards = await page.locator('.card').allTextContents();
const bundang = cards.find((t) => t.includes('분당 파크뷰') && t.includes('매매'));
check(bundang?.includes('자금 가능 · 여유 1.2억'), `후보 배지: 분당 55,000 매매 → 여유 1.2억 (명세 12,265)`);
const gangnam = cards.find((t) => t.includes('래미안대치팰리스'));
check(gangnam?.includes('11.8억 부족'), `후보 배지: 강남 180,000 → 11.8억 부족 (명세 −117,860)`);
const jeonse = cards.find((t) => t.includes('분당 파크뷰') && t.includes('전세'));
check(!!jeonse && /여유/.test(jeonse), '후보 배지: 전세 후보는 calcRent 로 판정');
check((await page.locator('.disclaimer').count()) > 0, '후보: 가늠용 안내');
check((await page.locator('button[aria-label^="내 선호"]').count()) === 15, '후보: 내 별점만 입력 가능 (3개 후보 × 5)');

await page.goto(`${BASE}/money`);
await page.waitForSelector('.verdict');
const verdict = await page.textContent('.verdict');
check(verdict.includes('살 수 있어요') && verdict.includes('여유 1억 2,265만원'), `자금 탭: 분당 55,000 여유 1억 2,265만원 (배지와 일치)`);
const maxCard = await page.locator('.card', { hasText: '최대 매수 가능 가격' }).textContent();
check(maxCard.includes('8억 1,000만원') && maxCard.includes('9억 4,500만원'), '자금 탭: 최대 매수가 8.1억 / 8.1억 / 9.45억');
check((await page.locator('.disclaimer').count()) > 0, '자금: 가늠용 안내');

const sticky = await page.textContent('.sticky-verdict');
check(sticky.includes('살 수 있어요') && sticky.includes('여유 1.2억'), `자금 탭: 상단 고정 요약 (${sticky.trim()})`);
check(!(await page.isVisible('#fin_bIncome')), '자금 탭: 이미 입력한 조건은 접혀 있고 요약만 보임');
// 입력 → 0.9초 디바운스 후 patch 저장, 입력 중에도 펼친 칸이 닫히지 않음
await page.click('summary:has-text("소득")');
await page.fill('#fin_bIncome', '3000');
check(await page.isVisible('#fin_bIncome'), '자금 탭: 입력하는 동안 펼친 칸이 유지됨');
check((await page.textContent('#fin_bIncome_h'))?.includes('3,000만원'), '자금 탭: 입력 금액을 한글 단위로 읽어줌');
await page.waitForTimeout(1500);
check(db.finances[0].data.bIncome === 3000, '자금 입력이 디바운스 후 patch_finances 로 저장됨');

await page.goto(`${BASE}/price`);
await page.waitForSelector('.pricegrid');
const pcard = await page.locator('.card', { hasText: '분당 파크뷰' }).textContent();
check(pcard.includes('5.5억') && pcard.includes('4억') && pcard.includes('73%'), '시세 카드: 매매·전세 분리 + 전세가율 73%');

await page.goto(`${BASE}/`);
await page.waitForSelector('.ruler');
check((await page.locator('.checklist').count()) === 0, '홈: 준비를 다 마치면 시작하기 목록이 사라짐');
check((await page.textContent('.dday')).includes('2027년 3월'), '헤더: 입주 목표 월 표기 (2027년 3월)');

// 국토부 실거래 불러오기
await page.goto(`${BASE}/price`);
await page.click('button[aria-label="분당 파크뷰 상세 보기"]');
await page.waitForSelector('[role=dialog]');
await page.click('text=실거래 불러오기');
await page.waitForSelector('ul.deals li');
check(molitCalls.at(-1)?.lawdCds?.[0] === '41135' && molitCalls.at(-1)?.name === '분당 파크뷰', `실거래: 분당구 코드 41135 와 단지명으로 조회 (${JSON.stringify(molitCalls.at(-1))})`);
await page.locator('.molit').screenshot({ path: `${SHOTS}/light-molit.png` });
const rows = await page.locator('ul.deals li').count();
check(rows === 3, `실거래: 관심 평형 84㎡ 만 기본 표시 (${rows}건, 59㎡ 제외)`);
const btn = await page.textContent('button:has-text("건 기록에 추가")');
check(btn.includes('2건'), `실거래: 해제 거래는 빼고 2건 선택 (${btn.trim()})`);
const before = db.price_records.length;
await page.click('button:has-text("건 기록에 추가")');
await page.waitForTimeout(600);
const added = db.price_records.slice(before);
check(added.length === 2 && added.every((r) => r.source === 'molit' && r.type === '실거래' && r.source_key), `실거래: 2건이 출처·중복키와 함께 저장 (${added.length})`);
check(added.some((r) => r.price_manwon === 56000 && r.date === '2026-09-12' && r.floor === '15층 84.97㎡'), '실거래: 가격·날짜·층·면적이 그대로 저장');
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
check(sw <= 360, `실거래 시트도 360px 에서 가로 스크롤 없음 (${sw})`);
await page.click('button[aria-pressed="false"]:has-text("전월세")');
await page.click('text=실거래 불러오기');
await page.waitForSelector('ul.deals li');
const rentBtn = await page.textContent('button:has-text("건 기록에 추가")');
check(rentBtn.includes('1건'), `실거래: 전월세는 월세 빼고 전세 1건만 선택 (${rentBtn.trim()})`);
await page.keyboard.press('Escape');

// 실거래 탐색 화면
await page.goto(`${BASE}/deals`);
await page.waitForSelector('text=실거래 조회');
check((await page.getAttribute('nav.tabs a[href="/price"]', 'aria-current')) === 'page', '탐색 화면에서도 시세 탭이 선택 상태');
await page.fill('#dName', '');
await page.click('button:has-text("실거래 조회")');
await page.waitForSelector('.grouphead');
check(molitCalls.at(-1)?.limit === 1000 && molitCalls.at(-1)?.lawdCds?.[0] === '41135', `탐색: 분당구 전체를 조회 (${JSON.stringify(molitCalls.at(-1))})`);
check((await page.locator('.grouphead').count()) === 2, '탐색: 단지별로 2곳 묶음');
await page.screenshot({ path: `${SHOTS}/light-deals.png`, fullPage: true });
const beforeCx = db.complexes.length, beforeP = db.price_records.length;
await page.locator('.card', { hasText: '정자한솔마을' }).locator('button:has-text("관심 단지로 담기")').click();
await page.waitForTimeout(700);
const newCx = db.complexes.slice(beforeCx);
check(newCx.length === 1 && newCx[0].molit_name === '정자한솔마을' && newCx[0].lawd_cd === '41135' && newCx[0].region === '경기 성남시 분당구', '탐색: 관심 단지로 담으면 단지명·코드·지역이 채워짐');
check(db.price_records.length - beforeP === 2, `탐색: 담으면서 실거래 2건 기록 (${db.price_records.length - beforeP})`);
await page.click('button[aria-pressed="false"]:has-text("거래별")');
check((await page.locator('li.dealrow').count()) === 6, '탐색: 거래별 보기 6건 (해제 거래도 표시)');
check((await page.locator('li.dealrow.off').count()) === 1, '탐색: 해제 거래는 흐리게');
const sw2 = await page.evaluate(() => document.documentElement.scrollWidth);
check(sw2 <= 360, `탐색 화면 360px 가로 스크롤 없음 (${sw2})`);

// 단지 추가: 국토부 단지명 찾기
await page.goto(`${BASE}/price`);
await page.click('text=단지 추가');
await page.fill('#cxName', '분당 파크');
await page.selectOption('#cxRegion', '경기 성남시 분당구');
await page.click('text=국토부 실거래 단지명으로 찾기');
await page.waitForSelector('button.pickname');
await page.click('button.pickname');
check((await page.textContent('[role=dialog]')).includes('국토부 단지명: 분당파크뷰'), '단지 추가: 국토부 단지명을 골라 저장 준비');
await page.keyboard.press('Escape');

// 시트: Esc 로 닫힘
await page.goto(`${BASE}/price`);
await page.click('text=단지 추가');
await page.waitForSelector('[role=dialog]');
await page.keyboard.press('Escape');
check((await page.locator('[role=dialog]').count()) === 0, '입력 시트가 Esc 로 닫힘');

await browser.close();
console.log(fails.length ? `\n${fails.length} failed` : '\nall passed');
process.exit(fails.length ? 1 : 0);
