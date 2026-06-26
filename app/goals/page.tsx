import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";

// Placeholder. The full quarter-calendar Goals board is the next build.
export default async function GoalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="shell">
      <TopNav email={user.email} />
      <main className="container container-tight">
        <div className="stack">
          <div>
            <div className="eyebrow">Goals</div>
            <h1 style={{ marginTop: 6 }}>Quarter calendar</h1>
            <p className="muted" style={{ marginTop: 6 }}>
              The full Goals board (quarter calendar, progress derived from your
              systems) is the next build. For now this is a placeholder.
            </p>
          </div>
          <div>
            <Link href="/today" className="link">
              &larr; Back to Today
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
