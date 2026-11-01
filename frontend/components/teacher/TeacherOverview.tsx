"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, ClipboardCheck, RefreshCw, Upload, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, LoadingPanel } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { StatCard } from "@/components/ui/StatCard";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { readableError } from "@/lib/format";
import { useAsync } from "@/lib/hooks";

export function TeacherOverview() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(() => api.teacherClasses(), []);

  if (loading && !data) return <LoadingPanel label="Loading your workspace…" />;
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

  const classes = data ?? [];
  const subjects = new Set(classes.flatMap((item) => item.subjects));
  const assigned = classes.filter((item) => item.teacherEmail?.toLowerCase() === user?.email?.toLowerCase());
  const academic = user?.school?.academic;

  return (
    <>
      <PageHeader
        title={`Good to see you, ${user?.name?.split(" ")[0] || "Teacher"}`}
        description={
          academic
            ? `${academic.currentTerm} · ${academic.currentSession} — enter scores and submit them for admin approval.`
            : "Enter scores and submit them for admin approval."
        }
        actions={
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={reload} loading={loading}>
            Refresh
          </Button>
        }
      />

      <div className="grid three" style={{ marginBottom: 20 }}>
        <StatCard icon={<BookOpen size={18} />} label="Classes available" value={classes.length} />
        <StatCard icon={<Users size={18} />} label="Subjects across classes" value={subjects.size} />
        <StatCard
          icon={<ClipboardCheck size={18} />}
          label="Assigned as form teacher"
          value={assigned.length}
          detail={assigned.map((item) => item.className).join(", ") || "No form class assigned"}
        />
      </div>

      <div className="grid two">
        <Card
          title="Classes & subjects"
          subtitle="Pick a class to start a score sheet."
          action={
            <Link href="/teacher/broadsheet" className="btn btn-primary btn-sm">
              Open score entry
            </Link>
          }
        >
          {classes.length === 0 ? (
            <EmptyState
              title="No classes configured"
              description="Ask your school admin to create classes and attach subjects."
            />
          ) : (
            <div className="stack" style={{ gap: 12 }}>
              {classes.map((item) => (
                <div key={item.id} className="class-row">
                  <div>
                    <strong>{item.className}</strong>
                    <div className="chip-list" style={{ marginTop: 6 }}>
                      {item.subjects.map((subject) => (
                        <span key={subject} className="chip">
                          {subject}
                        </span>
                      ))}
                    </div>
                  </div>
                  {assigned.some((entry) => entry.id === item.id) ? <Badge tone="green">Form class</Badge> : null}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="How results work">
          <ol className="steps">
            <li>
              <span className="step-index">1</span>
              <div>
                <strong>Enter scores</strong>
                <p className="small muted">CA1 and CA2 are scored over 20, the exam over 60.</p>
              </div>
            </li>
            <li>
              <span className="step-index">2</span>
              <div>
                <strong>Save the sheet</strong>
                <p className="small muted">Saving stores a draft — students cannot see it yet.</p>
              </div>
            </li>
            <li>
              <span className="step-index">3</span>
              <div>
                <strong>Submit for approval</strong>
                <p className="small muted">The admin reviews and publishes the results to report cards.</p>
              </div>
            </li>
          </ol>

          <div className="divider" />

          <Link href="/teacher/upload" className="row" style={{ gap: 10 }}>
            <span className="stat-icon">
              <Upload size={16} />
            </span>
            <span>
              <strong className="small">Have a spreadsheet ready?</strong>
              <span className="small muted" style={{ display: "block" }}>
                Import scores from CSV in one step.
              </span>
            </span>
            <ArrowRight size={16} style={{ marginLeft: "auto" }} />
          </Link>
        </Card>
      </div>
    </>
  );
}
