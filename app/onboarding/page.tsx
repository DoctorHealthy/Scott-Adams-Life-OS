import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import OnboardingWizard from "@/components/OnboardingWizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Accounts with systems already have a Life OS; edit it under Systems.
  const { count } = await supabase
    .from("systems")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) > 0) redirect("/today");

  return (
    <div className="shell">
      <TopNav email={user.email} />
      <main className="container container-tight">
        <div className="stack">
          <div>
            <div className="eyebrow">Welcome</div>
            <h1 style={{ marginTop: 6 }}>Build your Life OS</h1>
            <p className="muted" style={{ marginTop: 6 }}>
              A few minutes of honest answers. You get five personal systems, a
              sleep campaign, computed targets, and a coach that knows you.
              Everything stays editable.
            </p>
          </div>
          <OnboardingWizard email={user.email ?? ""} />
        </div>
      </main>
    </div>
  );
}
