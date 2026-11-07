import type { Metadata } from "next";
import { TeacherOverview } from "@/components/teacher/TeacherOverview";

export const metadata: Metadata = { title: "Teacher workspace" };

export default function TeacherHomePage() {
  return <TeacherOverview />;
}
