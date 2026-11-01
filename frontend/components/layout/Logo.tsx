import { cn } from "@/lib/cn";

export function Logo({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <div className={cn("brand", light && "brand-light", compact && "brand-compact")}>
      <span className="brand-mark" aria-hidden="true">
        S
      </span>
      {!compact ? (
        <span className="brand-copy">
          <strong>Syntax</strong>
          <small>SaaS</small>
        </span>
      ) : null}
    </div>
  );
}
