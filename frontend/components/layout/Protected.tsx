"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/constants";
import type { Role } from "@/lib/types";

export function Protected({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!roles.includes(user.role)) {
      router.replace(ROLE_HOME[user.role]);
    }
  }, [loading, roles, router, user]);

  if (loading || !user || !roles.includes(user.role)) {
    return (
      <div className="loading-panel" style={{ minHeight: "100vh" }}>
        <span className="spinner dark" aria-hidden="true" />
        Preparing your workspace…
      </div>
    );
  }

  return <>{children}</>;
}
