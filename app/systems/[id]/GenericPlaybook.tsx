import Link from "next/link";
import { METRIC_TYPES } from "@/lib/constants";
import type { System } from "@/lib/types";

function metricLabel(m: string) {
  return METRIC_TYPES.find((x) => x.value === m)?.label ?? m;
}

export default function GenericPlaybook({ system }: { system: System }) {
  const rows: { k: string; v: string | null }[] = [
    { k: "Rule", v: system.rule },
    { k: "Min", v: system.floor },
    { k: "Ceiling", v: system.ceiling },
    { k: "Anchor", v: system.anchor },
    { k: "When", v: system.schedule_block },
    { k: "What you log", v: metricLabel(system.metric_type) },
  ];

  return (
    <div className="stack">
      <div className="card">
        {rows.map((r) => (
          <div className="kv" key={r.k}>
            <span className="k">{r.k}</span>
            <span>{r.v || <span className="muted">Not set</span>}</span>
          </div>
        ))}
      </div>

      <div>
        <Link href="/systems" className="link">
          &larr; Back to systems
        </Link>
      </div>
    </div>
  );
}
