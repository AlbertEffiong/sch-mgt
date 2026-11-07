"use client";

import { BadgeCheck, Check, ChevronLeft, ChevronRight, RefreshCw, Undo2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, LoadingPanel } from "@/components/ui/EmptyState";
import { Field, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { formatDate, readableError } from "@/lib/format";
import { useAsync } from "@/lib/hooks";
import type { Assessment, AssessmentStatus } from "@/lib/types";

const STATUS_FILTERS: Array<{ value: AssessmentStatus | "all"; label: string }> = [
  { value: "Pending Approval", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Revised", label: "Returned" },
  { value: "all", label: "All" },
];

const STATUS_TONE: Record<AssessmentStatus, "amber" | "green" | "red"> = {
  "Pending Approval": "amber",
  Approved: "green",
  Revised: "red",
};

interface SheetGroup {
  key: string;
  className: string;
  subject: string;
  term: string;
  session: string;
  teacherEmail: string;
  rows: Assessment[];
}

export function ApprovalsManager() {
  const toast = useToast();
  const [status, setStatus] = useState<AssessmentStatus | "all">("Pending Approval");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAsync(
    () => api.listAssessments({ status, page, limit: 100 }),
    [status, page],
  );

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ rows: Assessment[]; label: string } | null>(null);
  const [note, setNote] = useState("");

  const groups = useMemo<SheetGroup[]>(() => {
    const map = new Map<string, SheetGroup>();
    (data?.items ?? []).forEach((row) => {
      const key = [row.classId, row.subject, row.term, row.session, row.teacherEmail].join("|");
      const group =
        map.get(key) ??
        ({
          key,
          className: row.className,
          subject: row.subject,
          term: row.term,
          session: row.session,
          teacherEmail: row.teacherEmail,
          rows: [],
        } satisfies SheetGroup);
      group.rows.push(row);
      map.set(key, group);
    });
    return [...map.values()];
  }, [data]);

  async function review(rows: Assessment[], action: "approve" | "reject", reason?: string) {
    if (rows.length === 0) return;
    const key = rows[0].id + action;
    setBusyKey(key);
    try {
      let done = 0;
      for (const row of rows) {
        if (row.status === "Approved" && action === "approve") continue;
        await api.reviewAssessment(row.id, action, reason);
        done += 1;
      }
      toast.push(
        action === "approve"
          ? `${done} result${done === 1 ? "" : "s"} approved and published.`
          : `${done} result${done === 1 ? "" : "s"} returned for revision.`,
      );
      reload();
    } catch (reasonValue) {
      toast.push(readableError(reasonValue), "error");
    } finally {
      setBusyKey(null);
    }
  }

  function confirmReject(event: FormEvent) {
    event.preventDefault();
    if (!rejectTarget) return;
    const rows = rejectTarget.rows;
    setRejectTarget(null);
    review(rows, "reject", note.trim() || undefined);
    setNote("");
  }

  return (
    <>
      <PageHeader
        title="Result approvals"
        description="Approve submitted score sheets to publish them on student report cards."
        actions={
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={reload} loading={loading}>
            Refresh
          </Button>
        }
      />

      <div className="segmented" style={{ marginBottom: 18 }}>
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={status === filter.value ? "active" : ""}
            onClick={() => {
              setStatus(filter.value);
              setPage(1);
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {error ? <Notice tone="danger">{readableError(error)}</Notice> : null}
      {loading && !data ? <LoadingPanel label="Loading submissions…" /> : null}

      {!loading && groups.length === 0 && !error ? (
        <Card>
          <EmptyState
            icon={<BadgeCheck size={22} />}
            title={status === "Pending Approval" ? "No results awaiting approval" : "Nothing here yet"}
            description={
              status === "Pending Approval"
                ? "When a teacher submits a score sheet it will appear here for review."
                : "Try a different filter to see other submissions."
            }
          />
        </Card>
      ) : null}

      <div className="stack" style={{ gap: 16 }}>
        {groups.map((group) => {
          const pendingRows = group.rows.filter((row) => row.status !== "Approved");
          const allApproved = pendingRows.length === 0;
          return (
            <Card
              key={group.key}
              title={`${group.className} · ${group.subject}`}
              subtitle={`${group.term} · ${group.session} · ${group.teacherEmail}`}
              action={
                <div className="row">
                  <Badge tone={allApproved ? "green" : "amber"}>
                    {allApproved ? "Published" : `${pendingRows.length} pending`}
                  </Badge>
                  {!allApproved ? (
                    <Button
                      size="sm"
                      icon={<Check size={14} />}
                      loading={busyKey === group.rows[0].id + "approve"}
                      onClick={() => review(pendingRows, "approve")}
                    >
                      Approve sheet
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Undo2 size={14} />}
                    onClick={() =>
                      setRejectTarget({
                        rows: pendingRows.length ? pendingRows : group.rows,
                        label: `${group.className} · ${group.subject}`,
                      })
                    }
                  >
                    Return
                  </Button>
                </div>
              }
              bodyClassName=""
            >
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>CA1</th>
                      <th>CA2</th>
                      <th>Exam</th>
                      <th>Total</th>
                      <th>Grade</th>
                      <th>Status</th>
                      <th>Submitted</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.id}>
                        <td className="mono">{row.studentId}</td>
                        <td>{row.ca1}</td>
                        <td>{row.ca2}</td>
                        <td>{row.exam}</td>
                        <td>
                          <strong>{row.total}</strong>
                        </td>
                        <td>
                          <Badge tone="brand">{row.grade}</Badge>
                        </td>
                        <td>
                          <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>
                        </td>
                        <td className="nowrap">{formatDate(row.submittedAt)}</td>
                        <td>
                          <div className="table-actions">
                            {row.status !== "Approved" ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={<Check size={14} />}
                                loading={busyKey === row.id + "approve"}
                                onClick={() => review([row], "approve")}
                              >
                                Approve
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="soft-danger"
                              icon={<Undo2 size={14} />}
                              onClick={() => setRejectTarget({ rows: [row], label: row.studentId })}
                            >
                              Return
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}
      </div>

      {data && data.total > data.limit ? (
        <div className="pagination" style={{ marginTop: 16 }}>
          <span>
            Page {data.page} of {Math.max(data.totalPages, 1)}
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
            <Button size="sm" variant="secondary" disabled={!data.hasNext} onClick={() => setPage((value) => value + 1)}>
              Next <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      ) : null}

      <Modal
        open={rejectTarget !== null}
        title="Return for revision"
        subtitle={rejectTarget?.label}
        onClose={() => setRejectTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" form="reject-form" variant="danger" icon={<Undo2 size={16} />}>
              Return results
            </Button>
          </>
        }
      >
        <form id="reject-form" className="form-stack" onSubmit={confirmReject}>
          <Field label="Note for the teacher" htmlFor="reject-note" hint="Optional. Explain what needs correcting.">
            <Textarea
              id="reject-note"
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Re-check the exam scores for the affected students."
            />
          </Field>
        </form>
      </Modal>
    </>
  );
}
