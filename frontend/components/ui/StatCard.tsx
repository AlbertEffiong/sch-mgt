import type { ReactNode } from "react";

export function StatCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "green" | "red" | "amber";
}) {
  return (
    <div className="stat-card">
      <span className={`stat-icon${tone ? ` stat-icon-${tone}` : ""}`}>{icon}</span>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
      {detail ? <div className="small muted">{detail}</div> : null}
    </div>
  );
}
