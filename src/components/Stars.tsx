const IDX = [1, 2, 3, 4, 5];

export function StarsRO({ value }: { value: number }) {
  const v = Math.round(value || 0);
  return (
    <span className="stars ro" role="img" aria-label={`${v}점`}>
      {IDX.map((i) => <span key={i} className={i <= v ? 'on' : ''} aria-hidden="true">★</span>)}
    </span>
  );
}

/** 같은 별을 다시 누르면 0점 */
export function StarsInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <span className="stars" role="group" aria-label={`${label} ${value}점`}>
      {IDX.map((i) => (
        <button
          key={i}
          type="button"
          className={i <= value ? 'on' : ''}
          aria-label={`${label} ${i}점`}
          aria-pressed={i <= value}
          onClick={() => onChange(value === i ? 0 : i)}
        >★</button>
      ))}
    </span>
  );
}
