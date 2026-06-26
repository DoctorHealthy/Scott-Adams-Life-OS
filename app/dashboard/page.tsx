import { redirect } from "next/navigation";

// Home is now the coach-driven Today surface.
export default function DashboardRedirect() {
  redirect("/today");
}
