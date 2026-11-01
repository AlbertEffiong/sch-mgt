import { Check, Dot } from "lucide-react";
import { passwordChecks } from "@/lib/validation";

export function PasswordChecklist({ value }: { value: string }) {
  const checks = passwordChecks(value);
  return (
    <div className="password-checks">
      {checks.map((check) => (
        <span key={check.label} className={check.met ? "met" : ""}>
          {check.met ? <Check size={13} /> : <Dot size={13} />}
          {check.label}
        </span>
      ))}
    </div>
  );
}
