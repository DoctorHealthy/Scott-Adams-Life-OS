// Shown by the service worker when a navigation fails offline. Static and
// public (no auth, no data) so it always renders from the cache.
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <div className="shell">
      <main className="container container-tight">
        <div className="stack" style={{ paddingTop: 60 }}>
          <div>
            <div className="eyebrow">Offline</div>
            <h1 style={{ marginTop: 6 }}>No connection</h1>
            <p className="muted" style={{ marginTop: 6 }}>
              Life OS needs the network to load your day. Reconnect and it will
              pick up where you left off. Anything you had open still counts;
              log it once you are back online.
            </p>
          </div>
          <div>
            <a href="/today" className="btn btn-primary btn-auto">
              Try again
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
