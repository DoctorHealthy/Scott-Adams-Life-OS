import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";
import DietPlaybook from "./DietPlaybook";
import GenericPlaybook from "./GenericPlaybook";
import { computeTargets } from "@/lib/diet/targets";
import { readDietConfig } from "@/lib/diet/config";
import type { System } from "@/lib/types";

export default async function PlaybookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: system } = await supabase
    .from("systems")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!system) notFound();

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  const sys = system as System;
  const isDiet = sys.domain === "Diet";

  return (
    <div className="shell">
      <TopNav email={user.email} />
      <main className="container container-tight">
        <div className="stack">
          <div>
            <Link href="/systems" className="link" style={{ fontSize: 13 }}>
              &larr; Systems
            </Link>
            <div className="eyebrow" style={{ marginTop: 10 }}>
              {sys.domain ?? "Custom"} playbook
            </div>
            <h1 style={{ marginTop: 6 }}>{sys.name}</h1>
            {sys.rule ? (
              <p className="muted" style={{ marginTop: 8, maxWidth: 600 }}>
                {sys.rule}
              </p>
            ) : null}
          </div>

          {isDiet ? (
            <DietPlaybook
              targets={computeTargets(profile)}
              config={readDietConfig(profile?.coaching_prefs)}
            />
          ) : (
            <GenericPlaybook system={sys} />
          )}
        </div>
      </main>
    </div>
  );
}
