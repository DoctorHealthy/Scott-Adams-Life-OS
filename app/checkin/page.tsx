import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import CheckinClient from "./CheckinClient";
import type { System } from "@/lib/types";

export default async function CheckinPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: systems } = await supabase
    .from("systems")
    .select("*")
    .eq("user_id", user.id)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <div className="shell">
      <TopNav email={user.email} />
      <main className="container container-tight">
        <CheckinClient systems={(systems as System[]) ?? []} userId={user.id} />
      </main>
    </div>
  );
}
