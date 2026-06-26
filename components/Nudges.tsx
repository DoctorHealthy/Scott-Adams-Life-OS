"use client";

import { useEffect, useState } from "react";
import { hhmmToMin, targetBedtime, type SleepConfig, type SleepLog } from "@/lib/sleep/sleep";
import type { DietWindow } from "@/lib/diet/config";

// Time-aware nudges, computed in code from the clock and the user's targets.
// Computed after mount (never during SSR) so there is no hydration mismatch.
export default function Nudges({
  sleepConfig,
  sleepLog,
  dietWindow,
}: {
  sleepConfig: SleepConfig;
  sleepLog: SleepLog;
  dietWindow: DietWindow;
}) {
  const [nudges, setNudges] = useState<string[]>([]);

  useEffect(() => {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const out: string[] = [];

    const wake = hhmmToMin(sleepConfig.currentWake);
    const bed = hhmmToMin(targetBedtime(sleepConfig));

    // Morning light window: open from wake to wake + 60 min.
    if (mins >= wake && mins <= wake + 60 && !sleepLog.morningLight) {
      out.push(
        "Morning light window is open. Get outside, 5 to 20 minutes, no sunglasses."
      );
    }

    // Wind-down: within 60 minutes before target bed (handle the midnight wrap).
    let untilBed = bed - mins;
    if (untilBed < -720) untilBed += 1440;
    if (untilBed > 720) untilBed -= 1440;
    if (untilBed >= 0 && untilBed <= 60 && !sleepLog.windDown) {
      out.push(
        `Wind-down soon. Screens down, book out. Target bed ${targetBedtime(sleepConfig)}.`
      );
    }

    // Dinner: if the last meal target is late, push it earlier (protects sleep).
    if (dietWindow.meal3 && hhmmToMin(dietWindow.meal3) >= 20 * 60) {
      out.push(
        `Dinner target is ${dietWindow.meal3}. Pull it earlier to protect tonight's sleep.`
      );
    }

    setNudges(out);
  }, [sleepConfig, sleepLog, dietWindow]);

  if (nudges.length === 0) return null;

  return (
    <div className="nudges">
      {nudges.map((n, i) => (
        <div className="nudge" key={i}>
          {n}
        </div>
      ))}
    </div>
  );
}
