"use client";

import { useEffect, useRef, useState } from "react";

// A numeric input that never fights typing. The classic bug is
// `<input type="number" value={aNumber} onChange={Number(e.target.value)}>`:
// a number input reports "" for any intermediate/invalid state, so clearing
// snaps the value to 0 and mid-edit keystrokes get clobbered. This keeps the
// raw string internally, commits a parsed number as you type, and only clamps
// on blur. type=text + inputMode gives the numeric keyboard without the
// spinner quirks.

type Props = {
  value: number | null;
  onValue: (n: number | null) => void;
  min?: number;
  max?: number;
  allowEmpty?: boolean; // empty commits to null instead of min/0
  allowDecimal?: boolean;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  "aria-label"?: string;
};

const fmt = (v: number | null) => (v == null ? "" : String(v));

export default function NumberField({
  value,
  onValue,
  min,
  max,
  allowEmpty = false,
  allowDecimal = false,
  placeholder,
  className,
  style,
  id,
  disabled,
  autoFocus,
  "aria-label": ariaLabel,
}: Props) {
  const [text, setText] = useState(() => fmt(value));
  const focused = useRef(false);

  // Sync the display from the outside value only when the field is NOT being
  // edited, so a stepper button or a fresh load updates it, but typing (and
  // clearing) is never clobbered mid-edit.
  useEffect(() => {
    if (!focused.current) setText(fmt(value));
  }, [value]);

  const pattern = allowDecimal ? /^-?\d*\.?\d*$/ : /^-?\d*$/;

  function clamp(n: number): number {
    let x = n;
    if (min != null) x = Math.max(min, x);
    if (max != null) x = Math.min(max, x);
    return allowDecimal ? x : Math.round(x);
  }

  function handleChange(raw: string) {
    if (raw !== "" && !pattern.test(raw)) return; // reject stray characters
    setText(raw);
    if (raw === "" || raw === "-" || raw === "." || raw === "-.") {
      if (allowEmpty) onValue(null);
      return; // keep editing; do not force a value yet
    }
    const n = Number(raw);
    if (Number.isFinite(n)) onValue(n); // live value, unclamped while typing
  }

  function handleBlur() {
    focused.current = false;
    if (text === "" || text === "-" || text === "." || text === "-.") {
      if (allowEmpty) {
        onValue(null);
        setText("");
      } else {
        const fallback = clamp(min ?? 0);
        onValue(fallback);
        setText(fmt(fallback));
      }
      return;
    }
    const n = clamp(Number(text));
    onValue(n);
    setText(fmt(n));
  }

  return (
    <input
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      value={text}
      placeholder={placeholder}
      className={className}
      style={style}
      id={id}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
    />
  );
}
