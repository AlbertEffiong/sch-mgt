"use client";

import Link from "next/link";
import {
  BadgeCheck,
  BookOpen,
  CalendarClock,
  GraduationCap,
  RefreshCw,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, LoadingPanel } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { StatCard } from "@/components/ui/StatCard";
import { api } from "@/lib/api";
import { currency, formatDate, isSchoolActive, readableError } from "@/lib/format";
import { useAsync } from "@/lib/hooks";

/** Admin landing page summarising curriculum, people and pending approvals. */
export function AdminOverview() {
  const { data, error, loading, reload } = useAsync(
    () =>
      Promise.all([
        api.getSchool(),
        api.listClasses(),
        api.listStudents({ limit: 5 }),
        api.listTeachers({ limit: 1 }),
        api.listAssessments({ status: "Pending Approval", limit: 5 }),
      ]),
    [],
  );

  if (loading && !data) return <LoadingPanel label="Loading your school…" />;
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
  if (!data) return null;

  const [school, classes, students, teachers, pending] = data;
  const active = isSchoolActive(school);

  return (
    <>
      <PageHeader
        title={`Welcome, ${school.principalName || school.name}`}
        description="Manage your curriculum, enrollment and result approvals from one place."
        actions={
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={reload} loading={loading}>
            Refresh
          </Button>
        }
      />

      {!active ? (
        <div style={{ marginBottom: 18 }}>
          <Notice tone="warn">
            <strong>Your subscription has expired.</strong>{" "}
            <Link href="/admin/subscription">Submit a payment receipt</Link> to restore teacher and student access.
          </Notice>
        </div>
      ) : null}

      <div className="grid four" style={{ marginBottom: 20 }}>
        <StatCard icon={<Users size={18} />} label="Students enrolled" value={students.total} />
        <StatCard icon={<BookOpen size={18} />} label="Classes configured" value={classes.length} />
        <StatCard icon={<GraduationCap size={18} />} label="Teachers" value={teachers.total} />
        <StatCard
          icon={<BadgeCheck size={18} />}
          label="Awaiting approval"
          value={pending.total}
          detail={pending.total ? "Open the approvals queue" : "Everything is reviewed"}
        />
      </div>

      <div className="grid sidebar-grid">
        <Card
          title="Recently enrolled students"
          subtitle="The newest learners in your school."
          action={
            <Link href="/admin/students" className="btn btn-secondary btn-sm">
              Manage students
            </Link>
          }
          bodyClassName=""
        >
          {students.items.length === 0 ? (
            <EmptyState
              title="No students yet"
              description="Enroll your first student to generate a unique admission ID."
              action={
                <Link href="/admin/students" className="btn btn-primary btn-sm">
                  Enroll a student
                </Link>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Admission ID</th>
                    <th>Class</th>
                    <th>Enrolled</th>
                  </tr>
                </thead>
                <tbody>
                  {students.items.map((student) => (
                    <tr key={student.id}>
                      <td>
                        <div className="person">
                          <span className="avatar">{student.fullName.slice(0, 2).toUpperCase()}</span>
                          <div className="person-text">
                            <strong>{student.fullName}</strong>
                            <span>{student.gender}</span>
                          </div>
                        </div>
                      </td>
                      <td className="mono">{student.studentId}</td>
                      <td>{student.currentClass}</td>
                      <td className="nowrap">{formatDate(student.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="stack">
          <Card title="Academic calendar">
            <div className="stack" style={{ gap: 12 }}>
              <div className="row-between">
                <span className="muted small">Session</span>
                <strong>{school.academic.currentSession}</strong>
              </div>
              <div className="row-between">
                <span className="muted small">Current term</span>
                <strong>{school.academic.currentTerm}</strong>
              </div>
              <div className="row-between">
                <span className="muted small">Terms per session</span>
                <strong>{school.academic.termsPerSession}</strong>
              </div>
              <div className="divider" />
              <div className="row-between">
                <span className="muted small">Subscription</span>
                <Badge tone={active ? "green" : "red"}>{active ? "Active" : "Expired"}</Badge>
              </div>
              <div className="row-between">
                <span className="muted small">Renews</span>
                <strong>{formatDate(school.subscriptionExpiresAt)}</strong>
              </div>
              <div className="row-between">
                <span className="muted small">Plan</span>
                <strong>{currency(school.planMonthly)}/mo</strong>
              </div>
              <Link href="/admin/settings" className="btn btn-secondary btn-sm">
                Update academic settings
              </Link>
            </div>
          </Card>

          <Card
            title="Pending approvals"
            action={
              <Link href="/admin/approvals" className="btn btn-secondary btn-sm">
                Review all
              </Link>
            }
          >
            {pending.items.length === 0 ? (
              <div className="row">
                <CalendarClock size={18} color="var(--success)" />
                <span className="small muted">No result sheets are waiting for approval.</span>
              </div>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {pending.items.map((item) => (
                  <div key={item.id} className="row-between">
                    <span className="small">
                      <strong>{item.subject}</strong> · {item.className}
                    </span>
                    <Badge tone="amber">{item.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
