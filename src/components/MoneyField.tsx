import { won } from '../lib/finance';

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

/** 만원 입력은 아래에 "1억 5,000만원" 식으로 바로 읽어준다 (큰 금액 자릿수 실수 방지) */
export function MoneyField({ id, label, unit, value, onChange, hint, placeholder, step }: Props) {
  const v = Number(value);
  const spoken = unit === '만원' && value !== '' && value != null && Number.isFinite(v) && v > 0 ? won(v) : '';
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
          aria-describedby={spoken || hint ? `${id}_h` : undefined}
        />
        <em>{unit}</em>
      </div>
      {(spoken || hint) && (
        <div className="hint" id={`${id}_h`}>
          {spoken && <b className="spoken num">{spoken}</b>}
          {spoken && hint && ' · '}
          {hint}
        </div>
      )}
    </label>
  );
}
