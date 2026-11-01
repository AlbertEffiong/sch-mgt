import type { Metadata } from "next";
import { OwnerOverview } from "@/components/owner/OwnerOverview";

export const metadata: Metadata = { title: "Owner overview" };

export default function OwnerPage() {
  return <OwnerOverview />;
}
