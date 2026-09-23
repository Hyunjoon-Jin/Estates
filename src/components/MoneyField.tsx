interface Props {
  id: string;
  label: string;
  unit: string;
  value: string | number | null | undefined;
  onChange: (v: string) => void;
  hint?: string;
  placeholder?: string;
  step?: string;
}

export function MoneyField({ id, label, unit, value, onChange, hint, placeholder, step }: Props) {
  return (
    <label className="f" htmlFor={id}>
      <span>{label}</span>
      <div className="unit">
        <input
          id={id}
          type="number"
          inputMode={step ? 'decimal' : 'numeric'}
          step={step ?? '1'}
          min="0"
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        <em>{unit}</em>
      </div>
      {hint && <div className="hint">{hint}</div>}
    </label>
  );
}
