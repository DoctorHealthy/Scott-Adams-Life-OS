"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signout } from "@/app/login/actions";

const LINKS = [
  { href: "/today", label: "Today" },
  { href: "/trends", label: "Trends" },
  { href: "/partner", label: "Partner" },
  { href: "/reminders", label: "Reminders" },
  { href: "/history", label: "History" },
  { href: "/systems", label: "Systems" },
];

export default function TopNav({ email }: { email?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="topbar">
      <div className="nav-left">
        <Link href="/today" className="brand">
          Life OS<span className="dot">.</span>
        </Link>
        {/* Desktop inline links */}
        <nav className="nav-links">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`nav-link${isActive(l.href) ? " active" : ""}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="right">
        {email ? <span className="muted nav-email">{email}</span> : null}
        <form action={signout} className="nav-signout-desktop">
          <button className="btn btn-ghost" type="submit">
            Sign out
          </button>
        </form>
        {/* Mobile menu button */}
        <button
          className="nav-toggle"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
        </button>
      </div>

      {/* Mobile dropdown */}
      {open ? (
        <nav className="nav-menu">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`nav-menu-link${isActive(l.href) ? " active" : ""}`}
            >
              {l.label}
            </Link>
          ))}
          {email ? (
            <span className="nav-menu-email muted">{email}</span>
          ) : null}
          <form action={signout}>
            <button className="btn btn-ghost nav-menu-signout" type="submit">
              Sign out
            </button>
          </form>
        </nav>
      ) : null}
    </header>
  );
}
