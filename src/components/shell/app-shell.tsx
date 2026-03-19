"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";

import { useTheme } from "@/components/shell/theme-provider";

type AppShellProps = {
  children: React.ReactNode;
  user: {
    email: string;
    fullName: string;
    role: "admin" | "member";
  } | null;
};

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const FeedIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 11a9 9 0 0 1 9 9" />
    <path d="M4 4a16 16 0 0 1 16 16" />
    <circle cx="5" cy="19" r="1" />
  </svg>
);

const EventsIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const AdminIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
  </svg>
);

const SunIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

const baseLinks = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/feed", label: "Feed", icon: FeedIcon },
  { href: "/events", label: "Events", icon: EventsIcon },
];

function isLinkActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname() || "/";
  const { theme, toggle } = useTheme();

  const links = useMemo(() => {
    if (user?.role === "admin") {
      return [...baseLinks, { href: "/admin", label: "Admin", icon: AdminIcon }];
    }
    return baseLinks;
  }, [user?.role]);

  const initials = user
    ? user.fullName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((name) => name[0]?.toUpperCase())
        .join("")
    : "";

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 z-50 hidden h-full w-[200px] flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-16 items-center px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-xs font-bold text-black">
              GB
            </div>
            <div className="leading-none">
              <p className="text-xs font-bold tracking-tight">GURUJI</p>
              <p className="text-[10px] text-muted">BAY AREA</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3 pt-4">
          {links.map((link) => {
            const active = isLinkActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "text-foreground border-l-2 border-accent"
                    : "text-muted hover:bg-surface-elevated hover:text-foreground"
                }`}
              >
                <link.icon />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {user ? (
          <div className="border-t border-border p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-accent-light/20 text-[10px] font-bold text-accent-light">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{user.fullName}</p>
                <p className="truncate text-[10px] text-muted">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <form action="/auth/signout" method="post" className="flex-1">
                <button
                  type="submit"
                  className="w-full rounded-md border border-border bg-surface-elevated py-1.5 text-xs font-medium text-muted hover:text-foreground"
                >
                  Sign out
                </button>
              </form>
              <button
                onClick={toggle}
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md border border-border bg-surface-elevated text-muted hover:text-foreground"
              >
                {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t border-border p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="flex-1 rounded-md border border-border bg-surface-elevated py-1.5 text-center text-xs font-medium text-muted hover:text-foreground"
              >
                Login
              </Link>
              <button
                onClick={toggle}
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md border border-border bg-surface-elevated text-muted hover:text-foreground"
              >
                {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              </button>
            </div>
            <Link
              href="/register"
              className="block w-full rounded-md bg-accent py-1.5 text-center text-xs font-bold text-black hover:bg-accent-light"
            >
              Join now
            </Link>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col md:ml-[200px]">
        <main className="flex-1 pb-[56px] md:pb-0">{children}</main>
      </div>

      {/* Mobile Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-[56px] items-center justify-around border-t border-border bg-surface-elevated md:hidden">
        {links.map((link) => {
          const active = isLinkActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <link.icon />
              <span className="text-[10px] font-medium">{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
