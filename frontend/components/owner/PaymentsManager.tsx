"use client";

import { CheckCircle2, ChevronLeft, ChevronRight, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PaymentActionModal } from "@/components/owner/PaymentActionModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, LoadingPanel } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { api } from "@/lib/api";
import { currency, formatDateTime, readableError } from "@/lib/format";
import { useAsync } from "@/lib/hooks";
import type { School, SubscriptionLog } from "@/lib/types";

type LogStatus = SubscriptionLog["status"];

const LOG_TONE: Record<LogStatus, "amber" | "green" | "red"> = {
  pending: "amber",
  verified: "green",
  rejected: "red",
};

export function PaymentsManager() {
  const [page, setPage] = useState(1);
  const [intent, setIntent] = useState<{ school: School; mode: "verify" | "reject" } | null>(null);

  const { data, error, loading, reload } = useAsync(
    () =>
      Promise.all([
        api.ownerSchools({ limit: 100 }),
        api.ownerPayments({ page, limit: 15 }),
      ]),
    [page],
  );

  const pending = (data?.[0].items ?? []).filter((school) => school.hasPendingPayment);
  const history = data?.[1];

  return (
    <>
      <PageHeader
        title="Payment verifications"
        description="Verify OPay bank transfers submitted by schools and review the subscription audit trail."
        actions={
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={reload} loading={loading}>
            Refresh
          </Button>
        }
      />

      {error ? (
        <div style={{ marginBottom: 18 }}>
          <Notice tone="danger">{readableError(error)}</Notice>
        </div>
      ) : null}

      <div className="stack">
        <Card
          title="Awaiting verification"
          subtitle="Confirm the reference against the OPay account before renewing."
          action={<Badge tone={pending.length ? "amber" : "green"}>{pending.length} pending</Badge>}
          bodyClassName=""
        >
          {loading && !data ? (
            <LoadingPanel label="Loading payment queue…" />
          ) : pending.length === 0 ? (
            <EmptyState title="The queue is clear" description="No school has an unverified transfer right now." />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>School</th>
                    <th>Reference</th>
                    <th>Amount</th>
                    <th>Submitted</th>
                    <th style={{ textAlign: "right" }}>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((school) => (
                    <tr key={school.id}>
                      <td>
                        <div className="person">
                          <span className="avatar">{school.uniqueSchoolPrefix.slice(0, 2)}</span>
                          <div className="person-text">
                            <strong>{school.name}</strong>
                            <span>{school.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="mono">{school.pendingPayment?.reference || "—"}</td>
                      <td>{currency(school.pendingPayment?.amount || 0)}</td>
                      <td className="nowrap">{formatDateTime(school.pendingPayment?.submittedAt)}</td>
                      <td>
                        <div className="table-actions">
                          <Button
                            size="sm"
                            variant="success"
                            icon={<CheckCircle2 size={14} />}
                            onClick={() => setIntent({ school, mode: "verify" })}
                          >
                            Verify
                          </Button>
                          <Button
                            size="sm"
                            variant="soft-danger"
                            icon={<XCircle size={14} />}
                            onClick={() => setIntent({ school, mode: "reject" })}
                          >
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Subscription audit log" subtitle="Verified, pending and rejected payment records." bodyClassName="">
          {loading && !data ? (
            <LoadingPanel label="Loading payment history…" />
          ) : !history || history.items.length === 0 ? (
            <EmptyState title="No payment history yet" description="Verified and rejected transfers will appear here." />
          ) : (
            <>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>School</th>
                      <th>Reference</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Submitted</th>
                      <th>Verified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.items.map((log) => (
                      <tr key={log.id}>
                        <td className="strong">{log.schoolName || log.schoolId}</td>
                        <td className="mono">{log.reference}</td>
                        <td>{currency(log.amount)}</td>
                        <td>
                          <Badge tone={LOG_TONE[log.status]}>{log.status}</Badge>
                        </td>
                        <td className="nowrap">{formatDateTime(log.createdAt)}</td>
                        <td className="nowrap">{formatDateTime(log.verifiedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <span>
                  Page {history.page} of {Math.max(history.totalPages, 1)}
                </span>
                <div className="pagination-controls">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<ChevronLeft size={14} />}
                    disabled={page <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!history.hasNext}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Next <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      <PaymentActionModal
        school={intent?.school ?? null}
        mode={intent?.mode ?? "verify"}
        onClose={() => setIntent(null)}
        onDone={reload}
      />
    </>
  );
}
