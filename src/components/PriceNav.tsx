import { NavLink } from 'react-router-dom';

/** 시세 탭 위쪽: 우리가 모은 관심 단지 / 국토부 실거래 탐색 */
export function PriceNav() {
  return (
    <nav className="seg pricenav" aria-label="시세 보기">
      <NavLink to="/price" end>관심 단지</NavLink>
      <NavLink to="/deals">실거래 탐색</NavLink>
    </nav>
  );
}
