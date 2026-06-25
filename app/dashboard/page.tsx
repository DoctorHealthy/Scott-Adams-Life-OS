import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signout } from "../login/actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, email, age, height_cm, weight_kg, activity_level")
    .eq("id", user.id)
    .single();

  const displayName = profile?.name || user.email?.split("@")[0] || "there";

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <span className="brand">
            Life OS<span className="dot">.</span>
          </span>
        </div>
        <div className="right">
          <span className="muted" style={{ fontSize: 13 }}>
            {profile?.email || user.email}
          </span>
          <form action={signout}>
            <button className="btn btn-ghost" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="container">
        <div className="stack">
          <div>
            <div className="eyebrow">Phase 1 online</div>
            <h1 style={{ marginTop: 6 }}>You&apos;re in, {displayName}.</h1>
            <p className="muted" style={{ marginTop: 8, maxWidth: 560 }}>
              Auth works, the session is live, and your profile row exists. This is
              the foundation. The systems engine and daily check-in land next.
            </p>
          </div>

          <div className="card">
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              Your account
            </div>
            <div className="kv">
              <span className="k">Name</span>
              <span>{profile?.name ?? "Not set yet"}</span>
            </div>
            <div className="kv">
              <span className="k">Email</span>
              <span>{profile?.email ?? user.email}</span>
            </div>
            <div className="kv">
              <span className="k">Age</span>
              <span>{profile?.age ?? "Not set yet"}</span>
            </div>
            <div className="kv">
              <span className="k">Height</span>
              <span>{profile?.height_cm ? `${profile.height_cm} cm` : "Not set yet"}</span>
            </div>
            <div className="kv">
              <span className="k">Weight</span>
              <span>{profile?.weight_kg ? `${profile.weight_kg} kg` : "Not set yet"}</span>
            </div>
            <div className="kv">
              <span className="k">Activity level</span>
              <span>{profile?.activity_level ?? "Not set yet"}</span>
            </div>
          </div>

          <p className="muted" style={{ fontSize: 13 }}>
            Profile stats get filled in Phase 3 (your seeded Big Five and the
            calorie engine). For now, this confirms the database and security
            are wired correctly.
          </p>
        </div>
      </main>
    </div>
  );
}
