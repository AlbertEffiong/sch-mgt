import type { Metadata } from "next";
import { TeachersManager } from "@/components/admin/TeachersManager";

export const metadata: Metadata = { title: "Teachers" };

export default function TeachersPage() {
  return <TeachersManager />;
}
