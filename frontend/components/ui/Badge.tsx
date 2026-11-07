import type { ReactNode } from "react";

export type BadgeTone = "green" | "red" | "amber" | "blue" | "brand" | "violet" | "gray";

export function Badge({ tone = "gray", dot = false, children }: { tone?: BadgeTone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot ? <span className="badge-dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
