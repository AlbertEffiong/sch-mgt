import type { Metadata } from "next";
import { ResultsUploader } from "@/components/teacher/ResultsUploader";

export const metadata: Metadata = { title: "Upload results" };

export default function UploadPage() {
  return <ResultsUploader />;
}
