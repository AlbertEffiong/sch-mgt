import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn("spinner-wrap", className)} role="status">
      <Loader2 className="spin" size={22} />
      {label ? <span>{label}</span> : null}
    </div>
  );
}

export function PageLoader({ label = "Loading workspace…" }: { label?: string }) {
  return (
    <div className="page-loader">
      <div className="page-loader-mark">S</div>
      <Spinner label={label} />
    </div>
  );
}
