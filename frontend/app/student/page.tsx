import type { Metadata } from "next";
import { StudentReport } from "@/components/student/StudentReport";

export const metadata: Metadata = { title: "Report card" };

export default function StudentHomePage() {
  return <StudentReport />;
}
