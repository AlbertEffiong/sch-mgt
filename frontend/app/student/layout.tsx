"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Protected } from "@/components/layout/Protected";
import { SubscriptionGate } from "@/components/layout/SubscriptionGate";
import { STUDENT_NAV } from "@/lib/navigation";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <Protected roles={["student"]}>
      <AppShell role="student" nav={STUDENT_NAV}>
        <SubscriptionGate role="student">{children}</SubscriptionGate>
      </AppShell>
    </Protected>
  );
}
