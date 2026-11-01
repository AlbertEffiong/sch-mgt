"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SubscriptionLock } from "@/components/layout/SubscriptionLock";
import { useAuth } from "@/lib/auth";
import { isSchoolActive } from "@/lib/format";
import type { Role } from "@/lib/types";

/**
 * Blocks subscription-protected screens until the school has an active plan.
 * The admin billing page stays reachable so a transfer receipt can be filed.
 */
export function SubscriptionGate({ role, children }: { role: Role; children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const school = user?.school ?? null;

  if (role === "owner" || !school) return <>{children}</>;
  if (isSchoolActive(school)) return <>{children}</>;

  const billingPage = role === "admin" && pathname === "/admin/subscription";
  if (billingPage) return <>{children}</>;

  return <SubscriptionLock school={school} mode={role === "admin" ? "admin" : role === "teacher" ? "teacher" : "student"} />;
}
