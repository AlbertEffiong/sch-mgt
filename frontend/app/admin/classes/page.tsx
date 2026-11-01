import type { Metadata } from "next";
import { ClassesManager } from "@/components/admin/ClassesManager";

export const metadata: Metadata = { title: "Classes & subjects" };

export default function ClassesPage() {
  return <ClassesManager />;
}
