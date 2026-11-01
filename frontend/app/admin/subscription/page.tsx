import type { Metadata } from "next";
import { SubscriptionManager } from "@/components/admin/SubscriptionManager";

export const metadata: Metadata = { title: "Subscription & billing" };

export default function SubscriptionPage() {
  return <SubscriptionManager />;
}
