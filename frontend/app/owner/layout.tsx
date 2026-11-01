"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Protected } from "@/components/layout/Protected";
import { OWNER_NAV } from "@/lib/navigation";

export default function OwnerLayout({ children }: { children: ReactNode }) {
  return (
    <Protected roles={["owner"]}>
      <AppShell role="owner" nav={OWNER_NAV}>
        {children}
      </AppShell>
    </Protected>
  );
}
