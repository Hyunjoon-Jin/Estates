import { isReg, type Params } from '../lib/finance';
import { GYEONGGI, OTHER, SEOUL } from '../lib/regions';

interface Props {
  id: string;
  value: string;
  onChange: (v: string) => void;
  params: Params;
}

export function RegionSelect({ id, value, onChange, params }: Props) {
  const opt = (v: string) => (
    <option key={v} value={v}>
      {v.replace(/^(서울|경기) /, '')}{isReg(v, null, params) ? ' · 규제' : ''}
    </option>
  );
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">선택</option>
      <optgroup label="서울">{SEOUL.map((s) => opt(`서울 ${s}`))}</optgroup>
      <optgroup label="경기">{GYEONGGI.map((s) => opt(`경기 ${s}`))}</optgroup>
      <optgroup label="그 외">{OTHER.map(opt)}</optgroup>
    </select>
  );
}
