import type { Metadata } from "next";
import { PaymentsManager } from "@/components/owner/PaymentsManager";

export const metadata: Metadata = { title: "Payments" };

export default function OwnerPaymentsPage() {
  return <PaymentsManager />;
}
