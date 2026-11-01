"use client";

import { FileText, Printer, RefreshCw } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, LoadingPanel } from "@/components/ui/EmptyState";
import { Field, Select } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { ApiError, api } from "@/lib/api";
import { SESSION_OPTIONS, TERMS } from "@/lib/constants";
import { readableError } from "@/lib/format";
import { gradeTone, remarkFor } from "@/lib/grading";
import { useAsync } from "@/lib/hooks";
import type { Term } from "@/lib/types";

export function StudentReport() {
  const [term, setTerm] = useState<Term | "">("");
  const [session, setSession] = useState("");
  const { data, error, loading, reload } = useAsync(
    () => api.studentResults({ term: term || undefined, session: session || undefined }),
    [term, session],
  );

  const noResults = error instanceof ApiError && (error.code === "NO_RESULTS" || error.status === 404);
  const remark = data ? remarkFor(data.average) : "";

  return (
    <>
      <PageHeader
        title="Report card"
        description="Approved results for the selected term. Use Print to save a PDF copy."
        actions={
          <div className="row print-hidden">
            <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={reload} loading={loading}>
              Refresh
            </Button>
            <Button icon={<Printer size={16} />} onClick={() => window.print()} disabled={!data}>
              Print
            </Button>
          </div>
        }
      />

      <div className="report-wrap">
        <Card bodyClassName="filter-bar print-hidden" style={{ marginBottom: 16 }}>
          <Field label="Term" htmlFor="report-term">
            <Select
              id="report-term"
              value={term}
              onChange={(event) => setTerm(event.target.value as Term | "")}
            >
              <option value="">Latest published</option>
              {TERMS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Session" htmlFor="report-session">
            <Select id="report-session" value={session} onChange={(event) => setSession(event.target.value)}>
              <option value="">Current session</option>
              {SESSION_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>
        </Card>

        {loading && !data ? <LoadingPanel label="Loading report card…" /> : null}

        {error && !noResults ? (
          <Notice tone="danger">
            {readableError(error)}{" "}
            <button className="btn btn-sm btn-secondary" onClick={reload}>
              Retry
            </button>
          </Notice>
        ) : null}

        {noResults ? (
          <Card>
            <EmptyState
              icon={<FileText size={22} />}
              title="No approved results yet"
              description="Results appear here after your teachers submit them and the school admin approves them."
            />
          </Card>
        ) : null}

        {data && data.published ? (
          <div className="report-card">
            <div className="report-head">
              <div className="report-school">
                <span className="brand-mark" aria-hidden="true">
                  {data.school.uniqueSchoolPrefix.slice(0, 2).toUpperCase() || "S"}
                </span>
                <div>
                  <h2>{data.school.name}</h2>
                  <p>
                    {data.student.currentClass} · {data.student.studentId}
                  </p>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <Badge tone="green">Published</Badge>
                <div className="small" style={{ color: "#93a1ba", marginTop: 6 }}>
                  {data.term} · {data.session}
                </div>
              </div>
            </div>

            <div className="report-meta">
              <div>
                <span>Student</span>
                <strong>{data.student.fullName}</strong>
              </div>
              <div>
                <span>Admission ID</span>
                <strong className="mono">{data.student.studentId}</strong>
              </div>
              <div>
                <span>Class</span>
                <strong>{data.student.currentClass}</strong>
              </div>
              <div>
                <span>Gender</span>
                <strong>{data.student.gender}</strong>
              </div>
            </div>

            <div className="report-body">
              <div className="report-summary">
                <div>
                  <span>Subjects</span>
                  <strong>{data.subjects.length}</strong>
                </div>
                <div>
                  <span>Total score</span>
                  <strong>{Math.round(data.total * 10) / 10}</strong>
                </div>
                <div>
                  <span>Average</span>
                  <strong>{data.average}%</strong>
                </div>
                <div>
                  <span>Position</span>
                  <strong>
                    {data.position > 0 ? `${data.position} of ${data.classSize}` : "—"}
                  </strong>
                </div>
              </div>

              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>CA1</th>
                      <th>CA2</th>
                      <th>Exam</th>
                      <th>Total</th>
                      <th>Grade</th>
                      <th>Remark</th>
                      <th>Teacher</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.subjects.map((subject) => (
                      <tr key={subject.subject}>
                        <td>
                          <strong>{subject.subject}</strong>
                        </td>
                        <td>{subject.ca1}</td>
                        <td>{subject.ca2}</td>
                        <td>{subject.exam}</td>
                        <td>
                          <strong>{subject.total}</strong>
                        </td>
                        <td>
                          <Badge tone={gradeTone(subject.grade)}>{subject.grade}</Badge>
                        </td>
                        <td className="small">{subject.remark}</td>
                        <td className="small">{subject.teacherName || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="row-between" style={{ marginTop: 16, alignItems: "flex-start" }}>
                <div>
                  <span className="small muted" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Overall remark
                  </span>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{data.remark || remark}</div>
                </div>
                {data.attendance ? (
                  <div className="small muted">
                    Attendance: <strong>{data.attendance.present}</strong> / {data.attendance.total}
                  </div>
                ) : null}
              </div>

              <div className="report-sign">
                <div>
                  <span>Class teacher</span>
                  <strong>{data.classTeacherName || "—"}</strong>
                </div>
                <div>
                  <span>Principal</span>
                  <strong>{data.principalName || data.school.principalName || "—"}</strong>
                </div>
                <div>
                  <span>Next term begins</span>
                  <strong>&nbsp;</strong>
                </div>
              </div>

              <p className="small muted" style={{ marginTop: 18, textAlign: "center" }}>
                Generated by Syntax SaaS · {data.school.name} · This report card is invalid without the school stamp.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
