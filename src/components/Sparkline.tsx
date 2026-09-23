import type { PriceRecord } from '../lib/types';

export function Sparkline({ prices }: { prices: PriceRecord[] }) {
  const pts = prices.filter((p) => p.price_manwon > 0 && p.date).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  if (pts.length < 2) return null;
  const vs = pts.map((p) => p.price_manwon);
  const mn = Math.min(...vs);
  const span = Math.max(...vs) - mn || 1;
  const W = 300, H = 56, pad = 6;
  const xy = pts.map((p, i) => [pad + (i * (W - 2 * pad)) / (pts.length - 1), H - pad - ((p.price_manwon - mn) / span) * (H - 2 * pad)]);
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline fill="none" stroke="var(--ink)" strokeWidth={2} vectorEffect="non-scaling-stroke" points={xy.map((p) => p.join(',')).join(' ')} />
    </svg>
  );
}
