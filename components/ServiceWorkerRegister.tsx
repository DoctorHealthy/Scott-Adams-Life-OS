"use client";

import { useEffect } from "react";

// Registers the service worker in production only. In dev it would cache Next's
// hot-reload assets and cause stale-file confusion, so we skip it there (and
// actively unregister any leftover worker).
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failures are non-fatal; the app works without offline.
      });
    } else {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
    }
  }, []);

  return null;
}
