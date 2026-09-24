import { useState, type ReactNode } from 'react';

/** 입력 묶음 접기. 닫혀 있어도 요약값이 보여서 무엇을 넣었는지 바로 안다. defaultOpen 은 처음 한 번만 쓴다. */
export function Disclosure({ title, summary, defaultOpen, children }: { title: string; summary?: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <details className="card disclosure" open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>
        <span className="d-title">{title}</span>
        {summary && <span className="d-sum num">{summary}</span>}
      </summary>
      <div className="d-body">{children}</div>
    </details>
  );
}
