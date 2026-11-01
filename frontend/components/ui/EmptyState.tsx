import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon ?? <Inbox size={30} />}
      <strong>{title}</strong>
      {description ? <span>{description}</span> : null}
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
    </div>
  );
}

export function LoadingPanel({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="loading-panel">
      <span className="spinner dark" aria-hidden="true" />
      {label}
    </div>
  );
}
