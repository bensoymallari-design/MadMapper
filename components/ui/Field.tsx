"use client";

import { useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

export function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="field" {...props} />;
}

export function NumberInput({
  value,
  onValueChange,
  min = 0,
  disabled = false
}: {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(String(value));

  return (
    <input
      className="field"
      inputMode="decimal"
      value={focused ? draft : String(value)}
      disabled={disabled}
      onFocus={() => {
        setFocused(true);
        setDraft(value === 0 ? "" : String(value));
      }}
      onBlur={() => {
        setFocused(false);
        if (draft.trim() === "") {
          onValueChange(0);
        }
      }}
      onChange={(event) => {
        const next = event.target.value;
        if (!/^\d*\.?\d*$/.test(next)) return;
        setDraft(next);
        if (next.trim() === "") {
          onValueChange(0);
          return;
        }
        const parsed = Number(next);
        if (Number.isFinite(parsed)) {
          onValueChange(Math.max(min, parsed));
        }
      }}
    />
  );
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="field" {...props} />;
}
