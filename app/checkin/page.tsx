import { redirect } from "next/navigation";

// The check-in is absorbed into the Today surface.
export default function CheckinRedirect() {
  redirect("/today");
}
