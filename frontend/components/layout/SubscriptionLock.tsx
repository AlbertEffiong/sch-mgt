"use client";

import { CheckCircle2, Clock3, CreditCard, Landmark, LockKeyhole, LogOut, Send, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { BANK_DETAILS } from "@/lib/constants";
import { currency, daysUntil, formatDate, readableError } from "@/lib/format";
import type { School } from "@/lib/types";

export function SubscriptionLock({ school, mode }: { school: School | null; mode: "admin" | "teacher" | "student" }) {
  const { refresh, signOut } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState(String(school?.planMonthly || 49));
  const [busy, setBusy] = useState(false);

  const logout = async () => {
    await signOut();
    router.replace("/login");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.submitBankTransfer(reference.trim(), Number(amount));
      await refresh();
      push("Payment receipt submitted. The platform owner will verify it shortly.");
      setReference("");
    } catch (error) {
      push(readableError(error), "error");
    } finally {
      setBusy(false);
    }
  };

  const that = school;
  const pending = that?.pendingPayment;

  return (
    <div className="lock-page">
      <Card className="lock-card">
        <div className="lock-hero">
          <span className="lock-icon">
            <LockKeyhole size={26} />
          </span>
          <div>
            <Badge tone="red" dot>
              Subscription expired
            </Badge>
            <h1>Results are temporarily locked</h1>
            <p>
              {mode === "admin"
                ? "Renew your school subscription to restore admin tools, teaching access and the student result portal."
                : "Your school's subscription has expired. Please contact the school administrator to restore access."}
            </p>
          </div>
        </div>

        <div className="lock-meta">
          <div>
            <span>School</span>
            <strong>{that?.name || "Your school"}</strong>
          </div>
          <div>
            <span>Expired on</span>
            <strong>{formatDate(that?.subscriptionExpiresAt)}</strong>
          </div>
          <div>
            <span>Plan</span>
            <strong>{currency(that?.planMonthly || 0)} / month</strong>
          </div>
        </div>

        <div className="bank-panel">
          <div className="bank-panel-head">
            <span>
              <Landmark size={18} />
              Pay via bank transfer
            </span>
            <Badge tone="violet">OPay</Badge>
          </div>
          <div className="bank-grid">
            <div>
              <span>Bank</span>
              <strong>{BANK_DETAILS.bank}</strong>
            </div>
            <div>
              <span>Account number</span>
              <strong className="mono">{BANK_DETAILS.accountNumber}</strong>
            </div>
            <div>
              <span>Account name</span>
              <strong>{BANK_DETAILS.accountName}</strong>
            </div>
          </div>
          <p className="bank-note">
            <Clock3 size={15} />
            Use your payment reference as narration, then submit the receipt below for owner verification.
          </p>
        </div>

        {mode === "admin" ? (
          pending ? (
            <div className="pending-box">
              <CheckCircle2 size={22} />
              <div>
                <strong>Receipt awaiting verification</strong>
                <p>
                  Reference <span className="mono">{pending.reference}</span> · {currency(pending.amount)} ·{" "}
                  {formatDate(pending.submittedAt)}
                </p>
                <small>Access will return automatically once the platform owner approves the payment.</small>
              </div>
              <Button variant="ghost" onClick={logout} icon={<LogOut size={16} />}>
                Sign out
              </Button>
            </div>
          ) : (
            <form className="lock-form" onSubmit={submit}>
              <div className="lock-form-grid">
                <Field label="Payment reference" htmlFor="lock-reference">
                  <Input
                    id="lock-reference"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder="e.g. OPAY-839201"
                    required
                    minLength={3}
                  />
                </Field>
                <Field label="Amount paid (₦)" htmlFor="lock-amount">
                  <Input
                    id="lock-amount"
                    type="number"
                    min={1}
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    required
                  />
                </Field>
              </div>
              <Button type="submit" loading={busy} icon={<Send size={16} />}>
                Submit payment receipt
              </Button>
            </form>
          )
        ) : (
          <div className="lock-actions">
            <div className="security-strip">
              <ShieldCheck size={17} />
              <span>
                {daysUntil(that?.subscriptionExpiresAt) === null
                  ? "Access is controlled by your school administrator."
                  : `Expired ${Math.abs(daysUntil(that?.subscriptionExpiresAt) || 0)} day(s) ago.`}
              </span>
            </div>
            <Button variant="secondary" onClick={logout} icon={<LogOut size={16} />}>
              Sign out
            </Button>
          </div>
        )}

        <div className="lock-foot">
          <CreditCard size={15} />
          <span>Need help? Contact Syntax SaaS support with your school prefix {that?.uniqueSchoolPrefix || ""}.</span>
        </div>
      </Card>
    </div>
  );
}
