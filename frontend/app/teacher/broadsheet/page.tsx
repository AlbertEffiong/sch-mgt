import type { Metadata } from "next";
import { BroadsheetEditor } from "@/components/teacher/BroadsheetEditor";

export const metadata: Metadata = { title: "Score entry" };

export default function BroadsheetPage() {
  return <BroadsheetEditor />;
}
