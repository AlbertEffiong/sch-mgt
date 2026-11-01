"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import { useState } from "react";
import { AuthAside } from "@/components/auth/AuthAside";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { REGISTRATION_OTP } from "@/lib/constants";
import { readableError } from "@/lib/format";

export default function RegisterSchoolPage() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    name: "",
    uniqueSchoolPrefix: "",
    email: "",
    principalName: "",
    password: "",
    confirmPassword: "",
    otp: "",
    planMonthly: "49",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!/^[A-Za-z]{2,6}$/.test(form.uniqueSchoolPrefix)) {
      setError("School prefix must be 2–6 letters.");
      return;
    }
    if (!/^\d{6}$/.test(form.otp)) {
      setError("Enter the 6-digit registration OTP.");
      return;
    }
    setBusy(true);
    try {
      await api.registerSchool({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        uniqueSchoolPrefix: form.uniqueSchoolPrefix.trim().toUpperCase(),
        principalName: form.principalName.trim() || undefined,
        planMonthly: Number(form.planMonthly) || 49,
        otp: form.otp,
      });
      toast.push("School registered. Sign in with your admin account.");
      router.push("/login");
    } catch (reason) {
      setError(readableError(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <AuthAside />
      <div className="auth-panel">
        <div className="auth-card">
          <Link href="/login" className="row small" style={{ marginBottom: 18, gap: 6 }}>
            <ArrowLeft size={14} /> Back to sign in
          </Link>
          <div className="row" style={{ gap: 10, marginBottom: 8 }}>
            <span className="stat-icon">
              <Building2 size={19} />
            </span>
            <h2>Register your school</h2>
          </div>
          <p>Create the admin account that will manage classes, teachers, students and results.</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            {error ? <div className="auth-alert">{error}</div> : null}

            <Field label="School name" htmlFor="name">
              <input
                id="name"
                className="input"
                placeholder="Bright Future Academy"
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                required
                minLength={2}
              />
            </Field>

            <div className="form-grid">
              <Field label="School prefix" htmlFor="prefix" hint="2–6 letters, used in student IDs.">
                <input
                  id="prefix"
                  className="input"
                  placeholder="BFA"
                  value={form.uniqueSchoolPrefix}
                  onChange={(event) => update("uniqueSchoolPrefix", event.target.value.toUpperCase())}
                  maxLength={6}
                  required
                />
              </Field>
              <Field label="Plan (₦ / month)" htmlFor="plan">
                <input
                  id="plan"
                  type="number"
                  min={0}
                  className="input"
                  value={form.planMonthly}
                  onChange={(event) => update("planMonthly", event.target.value)}
                />
              </Field>
            </div>

            <Field label="Principal / head teacher" htmlFor="principal">
              <input
                id="principal"
                className="input"
                placeholder="Mrs. Ada Okoro"
                value={form.principalName}
                onChange={(event) => update("principalName", event.target.value)}
              />
            </Field>

            <Field label="Admin email" htmlFor="email">
              <input
                id="email"
                type="email"
                className="input"
                placeholder="admin@yourschool.edu"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                autoComplete="email"
                required
              />
            </Field>

            <div className="form-grid">
              <Field label="Password" htmlFor="password" hint="8+ chars, upper, lower, number, symbol.">
                <input
                  id="password"
                  type="password"
                  className="input"
                  value={form.password}
                  onChange={(event) => update("password", event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </Field>
              <Field label="Confirm password" htmlFor="confirm">
                <input
                  id="confirm"
                  type="password"
                  className="input"
                  value={form.confirmPassword}
                  onChange={(event) => update("confirmPassword", event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </Field>
            </div>

            <Field label="Registration OTP" htmlFor="otp" hint={`Demo OTP: ${REGISTRATION_OTP}`}>
              <input
                id="otp"
                className="input"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={form.otp}
                onChange={(event) => update("otp", event.target.value.replace(/\D/g, ""))}
                required
              />
            </Field>

            <Button type="submit" size="lg" block loading={busy}>
              Create school account
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
