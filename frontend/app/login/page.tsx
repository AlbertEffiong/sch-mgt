"use client";

import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PasswordChecklist } from "@/components/ui/PasswordChecklist";
import { PageLoader } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ADMIN_OTP, DEMO_CREDENTIALS, REGISTRATION_OTP, ROLE_HOME, ROLE_LABELS, SESSION_OPTIONS } from "@/lib/constants";
import { readableError } from "@/lib/format";
import type { Role } from "@/lib/types";
import { isStrongPassword } from "@/lib/validation";

const TABS: Array<{ role: Role; icon: typeof ShieldCheck }> = [
  { role: "admin", icon: GraduationCap },
  { role: "teacher", icon: BookOpenCheck },
  { role: "student", icon: UserRound },
  { role: "owner", icon: ShieldCheck },
];

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const [role, setRole] = useState<Role>("admin");
  const [email, setEmail] = useState("");
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nextPath, setNextPath] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "";
    setNextPath(next.startsWith("/") && !next.startsWith("//") ? next : "");
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.replace(ROLE_HOME[user.role] || "/login");
    }
  }, [loading, user, router]);

  const switchRole = (next: Role) => {
    setRole(next);
    setOtp("");
    setPassword("");
  };

  const fillDemo = () => {
    const values = Object.fromEntries(DEMO_CREDENTIALS[role].map((item) => [item.label, item.value]));
    setEmail(values.Email || values["Admin email"] || "");
    setStudentId(values["Student ID"] || "");
    setPassword(values.Password || "");
    setOtp(values["Sign-in OTP"] || "");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const signed = await signIn({
        role,
        email: role === "student" ? undefined : email.trim(),
        studentId: role === "student" ? studentId.trim() : undefined,
        password,
        otp: role === "admin" ? otp.trim() : undefined,
      });
      push(`Welcome back${signed.name ? `, ${signed.name}` : ""}.`);
      const target = nextPath.startsWith(`/${signed.role}`) ? nextPath : ROLE_HOME[signed.role];
      router.replace(target || "/");
      router.refresh();
    } catch (error) {
      push(readableError(error), "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageLoader label="Checking your session…" />;

  return (
    <div className="login-page">
      <div className="login-aside">
        <div className="login-aside-glow one" />
        <div className="login-aside-glow two" />
        <div className="login-aside-inner">
          <Logo light />
          <div className="login-pitch">
            <span className="login-pill">
              <Sparkles size={14} /> The operating system for modern schools
            </span>
            <h1>
              Results, people and school operations in <em>one calm place.</em>
            </h1>
            <p>
              A multi-tenant school platform for owners, administrators and teachers — with parent-ready results
              that publish in seconds.
            </p>
          </div>
          <div className="login-features">
            <div>
              <BarChart3 size={19} />
              <span>
                <strong>Live school analytics</strong>
                Enrollment, subscriptions and performance at a glance.
              </span>
            </div>
            <div>
              <BookOpenCheck size={19} />
              <span>
                <strong>Approval-first results</strong>
                Teachers submit, admins approve, parents see verified results.
              </span>
            </div>
            <div>
              <ShieldCheck size={19} />
              <span>
                <strong>Secure by design</strong>
                Tenant isolation, strong passwords, OTP sign-in and audited access.
              </span>
            </div>
          </div>
          <div className="login-trust">
            <span>Built for Nigerian schools</span>
            <span>·</span>
            <span>OPay subscriptions</span>
            <span>·</span>
            <span>Print-ready report cards</span>
          </div>
        </div>
      </div>

      <div className="login-main">
        <div className="login-card">
          <div className="login-mobile-brand">
            <Logo />
          </div>
          <div className="login-heading">
            <p className="eyebrow">Welcome back</p>
            <h2>Sign in to your workspace</h2>
            <p>Choose your role and continue where you left off.</p>
          </div>

          <div className="role-tabs" role="tablist" aria-label="Account role">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.role}
                  type="button"
                  role="tab"
                  aria-selected={role === tab.role}
                  className={role === tab.role ? "active" : ""}
                  onClick={() => switchRole(tab.role)}
                >
                  <Icon size={16} />
                  {tab.role === "admin" ? "School" : tab.role === "student" ? "Student" : tab.role === "owner" ? "Owner" : "Teacher"}
                </button>
              );
            })}
          </div>

          <form className="login-form" onSubmit={submit}>
            {role === "student" ? (
              <Field label="Student ID" htmlFor="student-id" hint="Use the admission number issued by your school.">
                <div className="input-icon">
                  <UserRound size={16} />
                  <Input
                    id="student-id"
                    value={studentId}
                    onChange={(event) => setStudentId(event.target.value)}
                    placeholder="BFA/2026/001"
                    autoComplete="username"
                    required
                  />
                </div>
              </Field>
            ) : (
              <Field label={`${ROLE_LABELS[role]} email`} htmlFor="login-email">
                <div className="input-icon">
                  <Mail size={16} />
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@school.edu"
                    autoComplete="username"
                    required
                  />
                </div>
              </Field>
            )}

            <Field label="Password" htmlFor="login-password">
              <div className="input-icon has-action">
                <LockKeyhole size={16} />
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button type="button" className="input-action" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            {role === "admin" ? (
              <Field label="Sign-in OTP" htmlFor="login-otp" hint="The 6-digit code sent to your admin email.">
                <div className="input-icon">
                  <KeyRound size={16} />
                  <Input
                    id="login-otp"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    required
                  />
                </div>
              </Field>
            ) : null}

            <Button type="submit" loading={busy} size="lg" className="login-submit">
              Sign in to {role === "owner" ? "console" : role === "student" ? "results" : "workspace"}
              <ArrowRight size={17} />
            </Button>
          </form>

          <div className="demo-box">
            <div className="demo-box-head">
              <span>
                <Sparkles size={15} /> Demo access · {ROLE_LABELS[role]}
              </span>
              <button type="button" onClick={fillDemo}>
                Fill credentials
              </button>
            </div>
            <div className="demo-values">
              {DEMO_CREDENTIALS[role].map((item) => (
                <span key={item.label}>
                  <small>{item.label}</small>
                  <code>{item.value}</code>
                </span>
              ))}
            </div>
          </div>

          <div className="login-links">
            {role === "admin" || role === "owner" ? (
              <button type="button" onClick={() => setRegisterOpen(true)}>
                <GraduationCap size={15} /> Register a new school
              </button>
            ) : null}
            {role === "teacher" ? (
              <button type="button" onClick={() => setActivateOpen(true)}>
                <KeyRound size={15} /> Activate a teacher invite
              </button>
            ) : null}
            <span>
              <CheckCircle2 size={14} /> Protected by OTP and strong password checks
            </span>
          </div>
        </div>
      </div>

      <RegisterSchoolModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onRegistered={(registeredEmail) => {
          setRegisterOpen(false);
          setRole("admin");
          setEmail(registeredEmail);
          push("School registered. Sign in with your admin OTP.");
        }}
      />
      <ActivateTeacherModal
        open={activateOpen}
        onClose={() => setActivateOpen(false)}
        onActivated={async (activatedEmail, activatedPassword) => {
          try {
            await signIn({ role: "teacher", email: activatedEmail, password: activatedPassword });
            push("Teacher account activated.");
            router.replace("/teacher");
          } catch (error) {
            setActivateOpen(false);
            setRole("teacher");
            setEmail(activatedEmail);
            push(readableError(error), "error");
          }
        }}
      />
    </div>
  );
}

function RegisterSchoolModal({
  open,
  onClose,
  onRegistered,
}: {
  open: boolean;
  onClose: () => void;
  onRegistered: (email: string) => void;
}) {
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    prefix: "",
    otp: "",
    principalName: "",
    planMonthly: "49",
    session: SESSION_OPTIONS[Math.min(2, SESSION_OPTIONS.length - 1)],
  });

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isStrongPassword(form.password)) {
      push("Use a strong password that meets every requirement.", "error");
      return;
    }
    setBusy(true);
    try {
      await api.registerSchool({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        uniqueSchoolPrefix: form.prefix.trim().toUpperCase(),
        otp: form.otp.trim(),
        principalName: form.principalName.trim(),
        planMonthly: Number(form.planMonthly),
      });
      setForm({ name: "", email: "", password: "", prefix: "", otp: "", principalName: "", planMonthly: "49", session: form.session });
      onRegistered(form.email.trim());
    } catch (error) {
      push(readableError(error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Register your school"
      description="Create the school admin workspace. Your 30-day subscription starts immediately."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="register-school-form" loading={busy} icon={<GraduationCap size={16} />}>
            Create school
          </Button>
        </>
      }
    >
      <form id="register-school-form" className="form-grid" onSubmit={submit}>
        <Field label="School name" htmlFor="reg-name" className="span-2">
          <Input id="reg-name" value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Bright Future Academy" required minLength={2} />
        </Field>
        <Field label="Admin email" htmlFor="reg-email">
          <Input id="reg-email" type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="admin@school.edu" required />
        </Field>
        <Field label="School prefix" htmlFor="reg-prefix" hint="2–6 letters, used in student IDs.">
          <Input id="reg-prefix" value={form.prefix} onChange={(event) => update("prefix", event.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 6).toUpperCase())} placeholder="BFA" required minLength={2} maxLength={6} />
        </Field>
        <Field label="Principal name" htmlFor="reg-principal">
          <Input id="reg-principal" value={form.principalName} onChange={(event) => update("principalName", event.target.value)} placeholder="Dr. Ada Nwosu" />
        </Field>
        <Field label="Monthly plan (₦)" htmlFor="reg-plan">
          <Input id="reg-plan" type="number" min={0} step="0.01" value={form.planMonthly} onChange={(event) => update("planMonthly", event.target.value)} />
        </Field>
        <Field label="Academic session" htmlFor="reg-session" hint="Can be changed later in settings.">
          <Select id="reg-session" value={form.session} onChange={(event) => update("session", event.target.value)}>
            {SESSION_OPTIONS.map((session) => (
              <option key={session} value={session}>
                {session}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Registration OTP" htmlFor="reg-otp" hint={`Demo registration OTP: ${REGISTRATION_OTP}`}>
          <Input id="reg-otp" inputMode="numeric" maxLength={6} pattern="\d{6}" value={form.otp} onChange={(event) => update("otp", event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="081689" required />
        </Field>
        <Field label="Admin password" htmlFor="reg-password" className="span-2">
          <Input id="reg-password" type="password" value={form.password} onChange={(event) => update("password", event.target.value)} placeholder="Create a strong password" required />
          <PasswordChecklist value={form.password} />
        </Field>
      </form>
    </Modal>
  );
}

function ActivateTeacherModal({
  open,
  onClose,
  onActivated,
}: {
  open: boolean;
  onClose: () => void;
  onActivated: (email: string, password: string) => Promise<void>;
}) {
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", otp: "", password: "" });

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isStrongPassword(form.password)) {
      push("Use a strong password that meets every requirement.", "error");
      return;
    }
    setBusy(true);
    try {
      await api.verifyTeacherOtp({ email: form.email.trim(), otp: form.otp.trim(), password: form.password });
      await onActivated(form.email.trim(), form.password);
      setForm({ email: "", otp: "", password: "" });
      onClose();
    } catch (error) {
      push(readableError(error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Activate teacher account"
      description="Enter the invite code sent by your school admin, then choose your password."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="activate-teacher-form" loading={busy} icon={<KeyRound size={16} />}>
            Activate account
          </Button>
        </>
      }
    >
      <form id="activate-teacher-form" className="form-stack" onSubmit={submit}>
        <Field label="Teacher email" htmlFor="act-email">
          <Input id="act-email" type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="teacher@school.edu" required />
        </Field>
        <Field label="Invite OTP" htmlFor="act-otp" hint="Your admin can see the demo code in the teacher invite response.">
          <Input id="act-otp" inputMode="numeric" maxLength={6} value={form.otp} onChange={(event) => update("otp", event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" required />
        </Field>
        <Field label="New password" htmlFor="act-password">
          <Input id="act-password" type="password" value={form.password} onChange={(event) => update("password", event.target.value)} placeholder="Create a strong password" required />
          <PasswordChecklist value={form.password} />
        </Field>
        <p className="fine-print">Demo admin OTP is {ADMIN_OTP}. Never share real sign-in codes.</p>
      </form>
    </Modal>
  );
}
