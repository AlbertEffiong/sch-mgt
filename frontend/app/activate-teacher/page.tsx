"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound } from "lucide-react";
import { useState } from "react";
import { AuthAside } from "@/components/auth/AuthAside";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { readableError } from "@/lib/format";

export default function ActivateTeacherPage() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ email: "", otp: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api.verifyTeacherOtp({ email: form.email.trim(), otp: form.otp, password: form.password });
      toast.push("Teacher account activated. You can now sign in.");
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
              <KeyRound size={19} />
            </span>
            <h2>Activate teacher account</h2>
          </div>
          <p>Enter the activation code from your invitation and choose a password.</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            {error ? <div className="auth-alert">{error}</div> : null}
            <Field label="Email address" htmlFor="email">
              <input
                id="email"
                type="email"
                className="input"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </Field>
            <Field label="Activation OTP" htmlFor="otp">
              <input
                id="otp"
                className="input"
                inputMode="numeric"
                maxLength={6}
                value={form.otp}
                onChange={(event) => setForm((current) => ({ ...current, otp: event.target.value.replace(/\D/g, "") }))}
                required
              />
            </Field>
            <div className="form-grid">
              <Field label="New password" htmlFor="password">
                <input
                  id="password"
                  type="password"
                  className="input"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  required
                />
              </Field>
              <Field label="Confirm password" htmlFor="confirm">
                <input
                  id="confirm"
                  type="password"
                  className="input"
                  value={form.confirmPassword}
                  onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                  required
                />
              </Field>
            </div>
            <Button type="submit" size="lg" block loading={busy}>
              Activate account
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
