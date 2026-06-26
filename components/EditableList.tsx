"use client";

import { useState } from "react";

// Compact editable string list: each item is one row (text field + inline x),
// with an "add" row at the bottom. The standard list editor across playbooks.
export default function EditableList({
  items,
  placeholder,
  onChange,
  onCommit,
}: {
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
  onCommit: () => void;
}) {
  const [adding, setAdding] = useState("");

  function doAdd() {
    const v = adding.trim();
    if (!v) return;
    onChange([...items, v]);
    onCommit();
    setAdding("");
  }

  return (
    <div className="edit-list">
      {items.map((it, i) => (
        <div className="edit-row" key={i}>
          <input
            value={it}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            onBlur={onCommit}
          />
          <button
            className="edit-x"
            aria-label="Remove"
            onClick={() => {
              onChange(items.filter((_, j) => j !== i));
              onCommit();
            }}
          >
            &times;
          </button>
        </div>
      ))}
      <div className="edit-row">
        <input
          placeholder={placeholder}
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") doAdd();
          }}
        />
        <button className="btn btn-auto" onClick={doAdd} disabled={!adding.trim()}>
          Add
        </button>
      </div>
    </div>
  );
}
