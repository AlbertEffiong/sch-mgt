"use client";

import { CheckCircle2, ChevronLeft, ChevronRight, Power, RefreshCw, Search, XCircle } from "lucide-react";
import { useState } from "react";
import { PaymentActionModal } from "@/components/owner/PaymentActionModal";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState, LoadingPanel } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { currency, formatDate, isSchoolActive, readableError, subscriptionLabel } from "@/lib/format";
import { useAsync, useDebouncedValue } from "@/lib/hooks";
import type { School } from "@/lib/types";

interface PaymentIntent {
  school: School;
  mode: "verify" | "reject";
}

export function SchoolsManager() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const debouncedQuery = useDebouncedValue(query, 300);
  const [payment, setPayment] = useState<PaymentIntent | null>(null);
  const [statusTarget, setStatusTarget] = useState<School | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, error, loading, reload } = useAsync(
    () =>
      api.ownerSchools({
        q: debouncedQuery.trim() || undefined,
        status: status === "Active" || status === "Expired" ? status : undefined,
        page,
        limit: 10,
      }),
    [debouncedQuery, status, page],
  );

  async function toggleStatus() {
    if (!statusTarget) return;
    const next = isSchoolActive(statusTarget) ? "Expired" : "Active";
    setBusyId(statusTarget.id);
    try {
      await api.setSchoolStatus(statusTarget.id, next);
      toast.push(`${statusTarget.name} marked ${next.toLowerCase()}.`);
      setStatusTarget(null);
      reload();
    } catch (reason) {
      toast.push(readableError(reason), "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Schools"
        description="Every school tenant, its plan, subscription state and pending payment proof."
        actions={
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={reload} loading={loading}>
            Refresh
          </Button>
        }
      />

      <Card bodyClassName="" className="stack">
        <div className="filter-bar" style={{ padding: "16px 18px" }}>
          <div className="search-box">
            <Search size={15} />
            <input
              className="input"
              placeholder="Search name, email or prefix…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            className="select"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by subscription status"
          >
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Expired">Expired</option>
          </select>
          <span className="small muted">{data?.total ?? 0} school{data?.total === 1 ? "" : "s"}</span>
        </div>

        {error ? (
          <div style={{ padding: 18 }}>
            <Notice tone="danger">{readableError(error)}</Notice>
          </div>
        ) : null}

        {loading && !data ? (
          <LoadingPanel label="Loading schools…" />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No schools match this filter" description="Try a different search or status." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>School</th>
                    <th>Plan</th>
                    <th>Students</th>
                    <th>Expires</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((school) => {
                    const active = subscriptionLabel(school) === "Active";
                    return (
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
                        <td className="nowrap">{currency(school.planMonthly)}/mo</td>
                        <td>{school.studentCount ?? 0}</td>
                        <td className="nowrap">{formatDate(school.subscriptionExpiresAt)}</td>
                        <td>
                          <div className="stack" style={{ gap: 5 }}>
                            <Badge tone={active ? "green" : "red"}>{subscriptionLabel(school)}</Badge>
                            {school.hasPendingPayment ? <Badge tone="amber">Payment pending</Badge> : null}
                          </div>
                        </td>
                        <td>
                          <div className="table-actions">
                            {school.hasPendingPayment ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="success"
                                  icon={<CheckCircle2 size={14} />}
                                  onClick={() => setPayment({ school, mode: "verify" })}
                                >
                                  Verify
                                </Button>
                                <Button
                                  size="sm"
                                  variant="soft-danger"
                                  icon={<XCircle size={14} />}
                                  onClick={() => setPayment({ school, mode: "reject" })}
                                >
                                  Reject
                                </Button>
                              </>
                            ) : null}
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={<Power size={14} />}
                              onClick={() => setStatusTarget(school)}
                            >
                              {active ? "Expire" : "Activate"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <span>
                Page {data.page} of {Math.max(data.totalPages, 1)} · {data.total} total
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
                  disabled={!data.hasNext}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <PaymentActionModal
        school={payment?.school ?? null}
        mode={payment?.mode ?? "verify"}
        onClose={() => setPayment(null)}
        onDone={reload}
      />

      <ConfirmModal
        open={statusTarget !== null}
        title={`${isSchoolActive(statusTarget) ? "Expire" : "Activate"} school`}
        message={
          statusTarget ? (
            <span>
              <strong>{statusTarget.name}</strong> will be marked{" "}
              <strong>{isSchoolActive(statusTarget) ? "Expired" : "Active"}</strong>.
              {isSchoolActive(statusTarget)
                ? " Its teachers and students will lose access to subscription-protected data."
                : " The subscription will be extended by 30 days from today if it has already lapsed."}
            </span>
          ) : null
        }
        confirmLabel={isSchoolActive(statusTarget) ? "Expire subscription" : "Activate subscription"}
        tone={isSchoolActive(statusTarget) ? "danger" : "primary"}
        busy={busyId !== null}
        onConfirm={toggleStatus}
        onClose={() => setStatusTarget(null)}
      />
    </>
  );
}
