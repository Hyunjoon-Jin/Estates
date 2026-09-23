export function today(): string {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 'YYYY-MM' → 그 달 1일까지 남은 일수 */
export function ddays(moveIn: string): number {
  const t = new Date(`${moveIn}-01T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((t.getTime() - now.getTime()) / 864e5);
}
