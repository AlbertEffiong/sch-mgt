"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Protected } from "@/components/layout/Protected";
import { SubscriptionGate } from "@/components/layout/SubscriptionGate";
import { ADMIN_NAV } from "@/lib/navigation";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Protected roles={["admin"]}>
      <AppShell role="admin" nav={ADMIN_NAV}>
        <SubscriptionGate role="admin">{children}</SubscriptionGate>
      </AppShell>
    </Protected>
  );
}
