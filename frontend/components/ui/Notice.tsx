import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "info" | "warn" | "danger" | "success";

export function Notice({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  const Icon = tone === "danger" ? AlertCircle : tone === "warn" ? AlertTriangle : tone === "success" ? CheckCircle2 : Info;
  return (
    <div className={`notice notice-${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <Icon size={17} />
      <div>{children}</div>
    </div>
  );
}
