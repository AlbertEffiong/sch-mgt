import type { Metadata } from "next";
import { SettingsManager } from "@/components/admin/SettingsManager";

export const metadata: Metadata = { title: "School settings" };

export default function SettingsPage() {
  return <SettingsManager />;
}
