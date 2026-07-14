"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setSystemActive } from "@/app/systems/actions";

export default function PauseButton({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function pause() {
    if (
      !window.confirm(
        "Pause this system? It stops counting everywhere until you resume it."
      )
    )
      return;
    setBusy(true);
    await setSystemActive(id, false);
    router.refresh();
  }

  async function resume() {
    setBusy(true);
    await setSystemActive(id, true);
    router.refresh();
  }

  if (active) {
    return (
      <button
        type="button"
        className="btn btn-ghost btn-auto"
        onClick={pause}
        disabled={busy}
      >
        {busy ? "Pausing..." : "Pause system"}
      </button>
    );
  }

  return (
    <div className="alert" style={{ marginTop: 14 }}>
      <p className="muted" style={{ margin: 0 }}>
        This system is paused. It is not counted anywhere until you resume it.
      </p>
      <button
        type="button"
        className="btn btn-primary btn-auto"
        onClick={resume}
        disabled={busy}
        style={{ marginTop: 10 }}
      >
        {busy ? "Resuming..." : "Resume"}
      </button>
    </div>
  );
}
