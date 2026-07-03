import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import ProfileForm from "@/components/ProfileForm";
import { DEFAULT_TIMEZONE } from "@/lib/reminders/engine";
import type { ProfileInput } from "@/app/profile/actions";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, age, height_cm, weight_kg, activity_level, coaching_prefs")
    .eq("id", user.id)
    .single();

  const prefs = (profile?.coaching_prefs ?? {}) as {
    timezone?: unknown;
    intake?: { sex?: unknown; coachingStyle?: unknown };
  };
  const intake = prefs.intake ?? {};

  const activity = profile?.activity_level;
  const initial: ProfileInput = {
    name: profile?.name ?? "",
    age: profile?.age ?? null,
    sex: intake.sex === "female" ? "female" : "male",
    heightCm: profile?.height_cm ?? null,
    weightKg: profile?.weight_kg ?? null,
    activityLevel:
      activity === "sedentary" ||
      activity === "light" ||
      activity === "moderate" ||
      activity === "high" ||
      activity === "athlete"
        ? activity
        : "moderate",
    timezone: typeof prefs.timezone === "string" ? prefs.timezone : DEFAULT_TIMEZONE,
    coachingStyle:
      intake.coachingStyle === "hardcore" ||
      intake.coachingStyle === "firm" ||
      intake.coachingStyle === "gentle"
        ? intake.coachingStyle
        : "firm",
  };

  return (
    <div className="shell">
      <TopNav email={user.email} />
      <main className="container container-tight">
        <div className="stack">
          <div>
            <div className="eyebrow">Profile</div>
            <h1 style={{ marginTop: 6 }}>Your details</h1>
            <p className="muted" style={{ marginTop: 6 }}>
              Everything in one place. Change a stat and your targets update
              across the app.
            </p>
          </div>
          <ProfileForm initial={initial} />
        </div>
      </main>
    </div>
  );
}
