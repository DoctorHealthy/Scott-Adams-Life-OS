"use client";

// The full-year Goals view: the pinned vision as the north star, then the
// same quarter roadmap and inline editor used on Today, with room to breathe.
// Vision -> projects (direction, progress) -> the daily systems (execution).

import Link from "next/link";
import { useRouter } from "next/navigation";
import GoalsCard from "@/components/GoalsCard";
import { saveGoalsForYear } from "@/app/goals/actions";
import {
  goalProgress,
  type Goal,
  type LinkChoice,
  type ProgressInputs,
  type Quarter,
} from "@/lib/goals/goals";

export default function GoalsBoard({
  goals,
  year,
  thisQuarter,
  progressInputs,
  linkChoices,
  vision,
  mindSystemId,
}: {
  goals: Goal[];
  year: number;
  thisQuarter: Quarter;
  progressInputs: ProgressInputs;
  linkChoices: LinkChoice[];
  vision: string;
  mindSystemId: string | null;
}) {
  const router = useRouter();

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head-row">
          <span className="block-title">Vision</span>
          {mindSystemId ? (
            <Link
              href={`/systems/${mindSystemId}`}
              className="link"
              style={{ fontSize: 13 }}
            >
              Edit in Mind
            </Link>
          ) : null}
        </div>
        <p style={{ margin: 0, lineHeight: 1.55 }}>{vision}</p>
      </div>

      <GoalsCard
        initialGoals={goals}
        year={year}
        thisQuarter={thisQuarter}
        progressFor={(g) => goalProgress(g, progressInputs)}
        linkChoices={linkChoices}
        onPersist={async (next) => {
          await saveGoalsForYear(year, next);
          router.refresh();
        }}
      />

      <div>
        <Link href="/today" className="link">
          &larr; Back to Today
        </Link>
      </div>
    </div>
  );
}
