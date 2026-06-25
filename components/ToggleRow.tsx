"use client";

export default function ToggleRow({
  label,
  on,
  onClick,
  hint,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      className={`toggle-row${on ? " on" : ""}`}
      onClick={onClick}
      aria-pressed={on}
    >
      <span className="toggle-box">{on ? "✓" : ""}</span>
      <span className="toggle-label">
        {label}
        {hint ? <span className="toggle-hint muted">{hint}</span> : null}
      </span>
    </button>
  );
}
