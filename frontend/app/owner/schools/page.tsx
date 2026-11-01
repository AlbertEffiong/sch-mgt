import type { Metadata } from "next";
import { SchoolsManager } from "@/components/owner/SchoolsManager";

export const metadata: Metadata = { title: "Schools" };

export default function OwnerSchoolsPage() {
  return <SchoolsManager />;
}
