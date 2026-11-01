"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Protected } from "@/components/layout/Protected";
import { SubscriptionGate } from "@/components/layout/SubscriptionGate";
import { TEACHER_NAV } from "@/lib/navigation";

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <Protected roles={["teacher"]}>
      <AppShell role="teacher" nav={TEACHER_NAV}>
        <SubscriptionGate role="teacher">{children}</SubscriptionGate>
      </AppShell>
    </Protected>
  );
}
