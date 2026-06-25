import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import CheckinClient from "./CheckinClient";
import { computeTargets } from "@/lib/diet/targets";
import { readDietConfig } from "@/lib/diet/config";
import type { System } from "@/lib/types";

export default async function CheckinPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: systems }, { data: profile }] = await Promise.all([
    supabase
      .from("systems")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("users").select("*").eq("id", user.id).single(),
  ]);

  const targets = computeTargets(profile ?? null);
  const dietMenu = readDietConfig(profile?.coaching_prefs).menu;

  return (
    <div className="shell">
      <TopNav email={user.email} />
      <main className="container container-tight">
        <CheckinClient
          systems={(systems as System[]) ?? []}
          userId={user.id}
          targets={targets}
          dietMenu={dietMenu}
        />
      </main>
    </div>
  );
}
