"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signout } from "@/app/login/actions";

const LINKS = [
  { href: "/dashboard", label: "Home" },
  { href: "/checkin", label: "Check-in" },
  { href: "/history", label: "History" },
  { href: "/systems", label: "Systems" },
];

export default function TopNav({ email }: { email?: string }) {
  const pathname = usePathname();

  return (
    <header className="topbar">
      <div className="nav-left">
        <Link href="/dashboard" className="brand">
          Life OS<span className="dot">.</span>
        </Link>
        <nav className="nav-links">
          {LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`nav-link${active ? " active" : ""}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="right">
        {email ? <span className="muted nav-email">{email}</span> : null}
        <form action={signout}>
          <button className="btn btn-ghost" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
