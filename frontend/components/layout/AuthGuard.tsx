"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { PageLoader } from "@/components/ui/Spinner";
import { ROLE_HOME } from "@/lib/constants";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/types";

export function AuthGuard({ children, role }: { children: ReactNode; role?: Role }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next = `${window.location.pathname}${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    if (role && user.role !== role) {
      router.replace(ROLE_HOME[user.role] || "/login");
    }
  }, [loading, user, role, router]);

  if (loading) return <PageLoader />;
  if (!user) return <PageLoader label="Redirecting to sign in…" />;
  if (role && user.role !== role) return <PageLoader label="Opening your workspace…" />;
  return <>{children}</>;
}
