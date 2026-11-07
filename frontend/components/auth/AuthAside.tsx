import { BadgeCheck, LockKeyhole, ShieldCheck } from "lucide-react";

export function AuthAside() {
  return (
    <aside className="auth-aside">
      <div className="brand">
        <span className="brand-mark">S</span>
        <span className="brand-name">
          Syntax
          <span>School SaaS</span>
        </span>
      </div>

      <div className="auth-copy">
        <h1>
          One secure home for your <em>school records</em>.
        </h1>
        <p>
          Enroll students, configure classes, approve results and keep every school on its own isolated tenant — all from
          one polished workspace.
        </p>

        <div className="auth-features">
          <div className="auth-feature">
            <BadgeCheck size={18} />
            <div>
              <strong>Principal approval workflow</strong>
              <span>Teachers submit, admins review, parents see published results only.</span>
            </div>
          </div>
          <div className="auth-feature">
            <ShieldCheck size={18} />
            <div>
              <strong>Strict tenant isolation</strong>
              <span>Every query is scoped to the signed-in school with server-side authorization.</span>
            </div>
          </div>
          <div className="auth-feature">
            <LockKeyhole size={18} />
            <div>
              <strong>Subscription-aware access</strong>
              <span>The result portal locks automatically whenever a school subscription expires.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="small" style={{ color: "#7f8da6" }}>
        © {new Date().getFullYear()} Syntax SaaS · Secure by design
      </div>
    </aside>
  );
}
