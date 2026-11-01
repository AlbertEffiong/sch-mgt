import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "indigo",
  hint,
  action,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet";
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className={cn("stat-icon", `stat-icon-${tone}`)}>
          <Icon size={20} />
        </span>
        {action}
      </div>
      <p>{label}</p>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}
