import { Link, NavLink, useLocation } from 'react-router-dom';

const TABS: [string, string, string][] = [
  ['/', '홈', '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'],
  ['/price', '시세', '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M7 15l4-4 3 3 5-6"/>'],
  ['/visit', '임장', '<path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'],
  ['/cand', '후보', '<path d="M6 3h12v18l-6-4-6 4z"/>'],
  ['/money', '자금', '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M16 15h2"/>'],
  ['/policy', '정책', '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4"/><path d="M10 12h6M10 16h6"/>'],
];

export function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav className="tabs" aria-label="주 메뉴">
      <div className="in">
        {TABS.map(([to, label, icon]) => {
          const inner = (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon }} />
              {label}
            </>
          );
          // 실거래 탐색(/deals)은 시세 탭의 하위 화면
          if (to === '/price' && pathname === '/deals') {
            return <Link key={to} to={to} aria-current="page" onClick={() => window.scrollTo(0, 0)}>{inner}</Link>;
          }
          return <NavLink key={to} to={to} end={to === '/'} onClick={() => window.scrollTo(0, 0)}>{inner}</NavLink>;
        })}
      </div>
    </nav>
  );
}
