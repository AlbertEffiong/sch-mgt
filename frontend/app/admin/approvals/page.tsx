import type { Metadata } from "next";
import { ApprovalsManager } from "@/components/admin/ApprovalsManager";

export const metadata: Metadata = { title: "Result approvals" };

export default function ApprovalsPage() {
  return <ApprovalsManager />;
}
