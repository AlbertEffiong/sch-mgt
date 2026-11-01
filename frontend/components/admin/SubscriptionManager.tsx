"use client";

import { Building2, CheckCircle2, Clock, Copy, Landmark, ReceiptText, RefreshCw, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, LoadingPanel } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { StatCard } from "@/components/ui/StatCard";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { BANK_DETAILS } from "@/lib/constants";
import { currency, formatDate, isSchoolActive, readableError } from "@/lib/format";
import { useAsync } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";

const LOG_TONE = { pending: "amber", verified: "green", rejected: "red" } as const;

export function SubscriptionManager() {
  const toast = useToast();
  const { refresh } = useAuth();
  const { data, error, loading, reload } = useAsync(
    () => Promise.all([api.getSchool(), api.subscriptionLogs()]),
    [],
  );
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const school = data?.[0];
  const logs = data?.[1] ?? [];

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.push("Copy failed — please copy the details manually.", "error");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!school) return;
    const parsed = Number(amount);
    if (!reference.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      toast.push("Enter the transfer reference and a valid amount.", "error");
      return;
    }
    setBusy(true);
    try {
      await api.submitBankTransfer(reference.trim(), parsed);
      toast.push("Payment submitted. The owner will verify it shortly.");
      setReference("");
      setAmount("");
      reload();
      refresh();
    } catch (reason) {
      toast.push(readableError(reason), "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <LoadingPanel label="Loading subscription…" />;
  if (error && !data) {
    return (
      <Notice tone="danger">
        {readableError(error)}{" "}
        <button className="btn btn-sm btn-secondary" onClick={reload}>
          Retry
        </button>
      </Notice>
    );
  }
  if (!school) return null;

  const active = isSchoolActive(school);
  const pending = school.pendingPayment;

  return (
    <>
      <PageHeader
        title="Subscription & billing"
        description={`${currency(school.planMonthly)} per month keeps teacher and student portals unlocked.`}
        actions={
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={reload} loading={loading}>
            Refresh
          </Button>
        }
      />

      <div className="grid three" style={{ marginBottom: 20 }}>
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label="Plan status"
          value={active ? "Active" : "Expired"}
          tone={active ? "green" : "red"}
          detail={school.subscriptionExpiresAt ? `Valid until ${formatDate(school.subscriptionExpiresAt)}` : "Not activated yet"}
        />
        <StatCard icon={<Building2 size={18} />} label="Monthly plan" value={currency(school.planMonthly)} detail={school.name} />
        <StatCard
          icon={<Clock size={18} />}
          label="Pending payment"
          value={pending ? currency(pending.amount) : "None"}
          tone={pending ? "amber" : undefined}
          detail={pending ? `Ref ${pending.reference}` : "No transfer awaiting verification"}
        />
      </div>

      {pending ? (
        <div style={{ marginBottom: 18 }}>
          <Notice tone="warn">
            <strong>Payment under review.</strong> Your transfer of {currency(pending.amount)} (ref{" "}
            <span className="mono">{pending.reference}</span>) was submitted {formatDate(pending.submittedAt)}. Access
            is restored as soon as the owner verifies it.
          </Notice>
        </div>
      ) : null}

      <div className="grid sidebar-grid">
        <Card
          title="Pay by bank transfer"
          subtitle="Send the exact monthly amount, then submit the transfer reference below."
        >
          <div className="bank-card">
            <div className="bank-row">
              <span className="bank-icon">
                <Landmark size={18} />
              </span>
              <div>
                <span className="muted small">Bank</span>
                <strong>{BANK_DETAILS.bank}</strong>
              </div>
            </div>
            <div className="bank-row">
              <div>
                <span className="muted small">Account number</span>
                <strong className="mono bank-number">{BANK_DETAILS.accountNumber}</strong>
              </div>
              <Button
                size="sm"
                variant="secondary"
                icon={<Copy size={14} />}
                onClick={() => copy(BANK_DETAILS.accountNumber, "number")}
              >
                {copied === "number" ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="bank-row">
              <div>
                <span className="muted small">Account name</span>
                <strong>{BANK_DETAILS.accountName}</strong>
              </div>
              <Button
                size="sm"
                variant="secondary"
                icon={<Copy size={14} />}
                onClick={() => copy(BANK_DETAILS.accountName, "name")}
              >
                {copied === "name" ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="bank-row">
              <div>
                <span className="muted small">Amount due</span>
                <strong className="bank-number">{currency(school.planMonthly)}</strong>
              </div>
            </div>
          </div>

          <form className="form-stack" style={{ marginTop: 18 }} onSubmit={submit}>
            <Field label="Transfer reference" htmlFor="payment-ref" hint="Use the reference or session ID from your bank receipt.">
              <Input
                id="payment-ref"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="OPAY-2026-000123"
                required
              />
            </Field>
            <Field label="Amount transferred" htmlFor="payment-amount">
              <Input
                id="payment-amount"
                type="number"
                min={1}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder={String(school.planMonthly)}
                required
              />
            </Field>
            <Button type="submit" icon={<Send size={16} />} loading={busy} disabled={Boolean(pending)}>
              {pending ? "Payment already submitted" : "Submit payment for verification"}
            </Button>
            {pending ? (
              <span className="small muted">
                You can submit a new reference once the current one is verified or rejected.
              </span>
            ) : null}
          </form>
        </Card>

        <Card title="Payment history" subtitle="Every transfer submitted for this school." bodyClassName="">
          {logs.length === 0 ? (
            <EmptyState
              icon={<ReceiptText size={22} />}
              title="No payments yet"
              description="Your transfer receipts will appear here after the first submission."
            />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="mono">{log.reference}</td>
                      <td>{currency(log.amount)}</td>
                      <td>
                        <Badge tone={LOG_TONE[log.status]}>{log.status}</Badge>
                      </td>
                      <td className="nowrap">{formatDate(log.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
