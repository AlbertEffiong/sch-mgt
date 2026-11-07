"use client";

import {
  Building2,
  CalendarDays,
  LogOut,
  Menu,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Logo } from "@/components/layout/Logo";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";
import { initials, isSchoolActive } from "@/lib/format";
import type { NavItem } from "@/lib/navigation";
import type { Role } from "@/lib/types";

interface AppShellProps {
  children: ReactNode;
  role: Role;
  nav: NavItem[];
}

/**
 * Responsive workspace chrome: collapsible drawer on small screens and a
 * fixed sidebar on laptops. Navigation is supplied per role so the same shell
 * serves owners, admins, teachers and students.
 */
export function AppShell({ children, role, nav }: AppShellProps) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const school = user?.school;
  const name = user?.name || school?.name || ROLE_LABELS[role];
  const subtitle = role === "owner" ? "SaaS control centre" : school?.name || ROLE_LABELS[role];
  const active = role === "owner" ? true : isSchoolActive(school);

  const logout = async () => {
    await signOut();
    router.replace("/login");
  };

  const isActive = (href: string) => {
    if (href === `/${role}`) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="shell">
      <div className={`shell-overlay ${open ? "open" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside className={`shell-nav ${open ? "open" : ""}`}>
        <div className="shell-nav-top">
          <Link href="/" className="shell-brand" aria-label="Syntax SaaS home">
            <Logo light />
          </Link>
          <button type="button" className="shell-nav-close" onClick={() => setOpen(false)} aria-label="Close navigation">
            <X size={20} />
          </button>
        </div>

        <div className="shell-school">
          <span className="shell-school-icon">
            {role === "owner" ? <ShieldCheck size={18} /> : <Building2 size={18} />}
          </span>
          <div>
            <strong>{role === "owner" ? "Platform owner" : school?.name || ROLE_LABELS[role]}</strong>
            <small>{role === "owner" ? "All schools" : ROLE_LABELS[role]}</small>
          </div>
        </div>

        <nav className="shell-links" aria-label="Primary navigation">
          <p className="shell-section-label">Workspace</p>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`shell-link ${isActive(item.href) ? "active" : ""}`}>
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="shell-nav-bottom">
          {school ? (
            <div className="shell-subscription">
              <span>Subscription</span>
              <Badge tone={active ? "green" : "red"} dot>
                {active ? "Active" : "Expired"}
              </Badge>
            </div>
          ) : null}
          <button type="button" className="shell-user" onClick={logout}>
            <span className="avatar">{initials(name)}</span>
            <span className="shell-user-copy">
              <strong>{name}</strong>
              <small>Sign out</small>
            </span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <div className="shell-main">
        <header className="shell-topbar">
          <button type="button" className="shell-menu" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu size={22} />
          </button>
          <div className="shell-topbar-title">
            <span>{ROLE_LABELS[role]}</span>
            {school ? <strong>{school.name}</strong> : <strong>Syntax SaaS</strong>}
          </div>
          <div className="shell-topbar-right">
            {school ? (
              <span className="session-chip">
                <CalendarDays size={15} />
                {school.academic.currentSession} · {school.academic.currentTerm}
              </span>
            ) : (
              <span className="session-chip">
                <ShieldCheck size={15} />
                Multi-school console
              </span>
            )}
            <span className="topbar-avatar" title={subtitle}>
              {initials(name)}
            </span>
          </div>
        </header>
        <main className="shell-content">{children}</main>
      </div>
    </div>
  );
}
