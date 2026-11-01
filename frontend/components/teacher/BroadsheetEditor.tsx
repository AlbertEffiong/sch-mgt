"use client";

import { CheckCircle2, ClipboardCheck, Save, Send, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState, LoadingPanel } from "@/components/ui/EmptyState";
import { Field, Select } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { TERMS } from "@/lib/constants";
import { gradeFor, clamp, gradeTone } from "@/lib/grading";
import { readableError, isSubscriptionError } from "@/lib/format";
import { useAsync } from "@/lib/hooks";
import type { Assessment, Student, Term } from "@/lib/types";

interface SheetRow {
  ca1: string;
  ca2: string;
  exam: string;
}

interface LoadedSheet {
  key: string;
  roster: Student[];
  assessments: Assessment[];
}

const TONE = { amber: "amber", green: "green", red: "red" } as const;

export function BroadsheetEditor() {
  const toast = useToast();
  const { user } = useAuth();
  const academic = user?.school?.academic;

  const { data: classes, error: classesError, loading: classesLoading } = useAsync(() => api.teacherClasses(), []);
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");
  const [term, setTerm] = useState<Term>(academic?.currentTerm ?? "First Term");
  const [session, setSession] = useState(academic?.currentSession ?? "");
  const [rows, setRows] = useState<Record<string, SheetRow>>({});
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  useEffect(() => {
    if (!classes || classes.length === 0) return;
    if (!classId || !classes.some((item) => item.id === classId)) {
      setClassId(classes[0].id);
    }
  }, [classes, classId]);

  const selectedClass = classes?.find((item) => item.id === classId) ?? null;

  useEffect(() => {
    if (!selectedClass) return;
    if (!selectedClass.subjects.includes(subject)) {
      setSubject(selectedClass.subjects[0] ?? "");
    }
  }, [selectedClass, subject]);

  const key = classId && subject && term && session ? `${classId}|${subject}|${term}|${session}` : "";

  const { data, error, loading, reload } = useAsync<LoadedSheet | null>(async () => {
    if (!key) return null;
    const [roster, assessments] = await Promise.all([
      api.roster(classId),
      api.broadsheet({ classId, subject, term, session }),
    ]);
    return { key, roster, assessments };
  }, [key]);

  useEffect(() => {
    if (!data || data.key !== key) return;
    const existing = new Map(data.assessments.map((entry) => [entry.studentId, entry]));
    const next: Record<string, SheetRow> = {};
    data.roster.forEach((student) => {
      const assessment = existing.get(student.studentId);
      next[student.studentId] = {
        ca1: assessment ? String(assessment.ca1) : "",
        ca2: assessment ? String(assessment.ca2) : "",
        exam: assessment ? String(assessment.exam) : "",
      };
    });
    setRows(next);
  }, [data, key]);

  const sheetReady = Boolean(data && data.key === key);
  const roster = sheetReady ? data!.roster : [];
  const assessmentMap = useMemo(
    () => new Map((sheetReady ? data!.assessments : []).map((entry) => [entry.studentId, entry])),
    [data, sheetReady],
  );

  function setScore(studentId: string, field: keyof SheetRow, value: string) {
    const max = field === "exam" ? 60 : 20;
    const numeric = value === "" ? "" : String(Math.max(0, Math.min(max, Number(value) || 0)));
    setRows((current) => ({
      ...current,
      [studentId]: { ...(current[studentId] ?? { ca1: "", ca2: "", exam: "" }), [field]: numeric },
    }));
  }

  function payloadEntries() {
    return roster.map((student) => {
      const row = rows[student.studentId] ?? { ca1: "", ca2: "", exam: "" };
      return {
        studentId: student.studentId,
        ca1: clamp(row.ca1, 20),
        ca2: clamp(row.ca2, 20),
        exam: clamp(row.exam, 60),
      };
    });
  }

  async function saveDraft(announce = true) {
    if (!key || roster.length === 0) return false;
    setBusy("save");
    try {
      const result = await api.saveBroadsheet({ classId, subject, term, session, entries: payloadEntries() });
      if (announce) toast.push(`Draft saved for ${result.saved} student${result.saved === 1 ? "" : "s"}.`);
      reload();
      return true;
    } catch (reason) {
      toast.push(isSubscriptionError(reason) ? "Your school subscription has expired." : readableError(reason), "error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function submitSheet() {
    if (!key) return;
    setConfirmSubmit(false);
    setBusy("submit");
    try {
      const saved = await api.saveBroadsheet({ classId, subject, term, session, entries: payloadEntries() });
      if (saved.saved === 0) {
        toast.push("No scores were saved — enter scores before submitting.", "error");
        return;
      }
      const result = await api.submitBroadsheet({
        classId,
        subject,
        term,
        session,
        principalName: user?.school?.principalName,
      });
      toast.push(`${result.submitted} result${result.submitted === 1 ? "" : "s"} submitted for approval.`);
      reload();
    } catch (reason) {
      toast.push(isSubscriptionError(reason) ? "Your school subscription has expired." : readableError(reason), "error");
    } finally {
      setBusy(null);
    }
  }

  const filled = Object.values(rows).filter((row) => row.ca1 !== "" || row.ca2 !== "" || row.exam !== "").length;

  return (
    <>
      <PageHeader
        title="Score entry"
        description="Select a class and subject, then record continuous assessment and exam scores."
        actions={
          <Link href="/teacher/upload" className="btn btn-secondary btn-sm">
            <Upload size={15} /> Import CSV
          </Link>
        }
      />

      {classesError ? <Notice tone="danger">{readableError(classesError)}</Notice> : null}

      {classesLoading && !classes ? (
        <LoadingPanel label="Loading classes…" />
      ) : !classes || classes.length === 0 ? (
        <Card>
          <EmptyState
            title="No classes available"
            description="Your school admin needs to create classes before results can be entered."
          />
        </Card>
      ) : (
        <>
          <Card bodyClassName="broadsheet-toolbar" title="Sheet selection">
            <div className="form-grid">
              <Field label="Class" htmlFor="sheet-class">
                <Select id="sheet-class" value={classId} onChange={(event) => setClassId(event.target.value)}>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.className}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Subject" htmlFor="sheet-subject">
                <Select id="sheet-subject" value={subject} onChange={(event) => setSubject(event.target.value)}>
                  {(selectedClass?.subjects ?? []).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Term" htmlFor="sheet-term">
                <Select id="sheet-term" value={term} onChange={(event) => setTerm(event.target.value as Term)}>
                  {TERMS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Session" htmlFor="sheet-session">
                <input
                  id="sheet-session"
                  className="input"
                  value={session}
                  onChange={(event) => setSession(event.target.value)}
                  placeholder="2025/2026"
                />
              </Field>
            </div>
          </Card>

          <div className="broadsheet-summary">
            <div className="row" style={{ gap: 8 }}>
              <Badge tone="brand">{selectedClass?.className}</Badge>
              <Badge tone="blue">{subject}</Badge>
              <span className="small muted">
                {term} · {session}
              </span>
            </div>
            <div className="row">
              <span className="small muted">
                {filled}/{roster.length} entered
              </span>
              <Button
                variant="secondary"
                icon={<Save size={16} />}
                loading={busy === "save"}
                disabled={!sheetReady || roster.length === 0 || busy !== null}
                onClick={() => saveDraft()}
              >
                Save draft
              </Button>
              <Button
                icon={<Send size={16} />}
                loading={busy === "submit"}
                disabled={!sheetReady || roster.length === 0 || busy !== null}
                onClick={() => setConfirmSubmit(true)}
              >
                Submit for approval
              </Button>
            </div>
          </div>

          {error && !data ? (
            <Notice tone="danger">
              {readableError(error)}{" "}
              <button className="btn btn-sm btn-secondary" onClick={reload}>
                Retry
              </button>
            </Notice>
          ) : null}

          {loading && !sheetReady ? (
            <LoadingPanel label="Loading roster…" />
          ) : roster.length === 0 ? (
            <Card>
              <EmptyState
                icon={<ClipboardCheck size={22} />}
                title="No students in this class"
                description="Enroll students into the selected class to start entering scores."
              />
            </Card>
          ) : (
            <Card bodyClassName="">
              <div className="table-wrap">
                <table className="data broadsheet-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Student</th>
                      <th>CA1 (20)</th>
                      <th>CA2 (20)</th>
                      <th>Exam (60)</th>
                      <th>Total</th>
                      <th>Grade</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((student, index) => {
                      const row = rows[student.studentId] ?? { ca1: "", ca2: "", exam: "" };
                      const empty = row.ca1 === "" && row.ca2 === "" && row.exam === "";
                      const score = clamp(row.ca1, 20) + clamp(row.ca2, 20) + clamp(row.exam, 60);
                      const assessment = assessmentMap.get(student.studentId);
                      return (
                        <tr key={student.id}>
                          <td className="muted">{index + 1}</td>
                          <td>
                            <div className="person-text">
                              <strong>{student.fullName}</strong>
                              <span className="mono">{student.studentId}</span>
                            </div>
                          </td>
                          <td>
                            <input
                              className="input score-input"
                              type="number"
                              min={0}
                              max={20}
                              value={row.ca1}
                              onChange={(event) => setScore(student.studentId, "ca1", event.target.value)}
                              aria-label={`CA1 for ${student.fullName}`}
                            />
                          </td>
                          <td>
                            <input
                              className="input score-input"
                              type="number"
                              min={0}
                              max={20}
                              value={row.ca2}
                              onChange={(event) => setScore(student.studentId, "ca2", event.target.value)}
                              aria-label={`CA2 for ${student.fullName}`}
                            />
                          </td>
                          <td>
                            <input
                              className="input score-input"
                              type="number"
                              min={0}
                              max={60}
                              value={row.exam}
                              onChange={(event) => setScore(student.studentId, "exam", event.target.value)}
                              aria-label={`Exam for ${student.fullName}`}
                            />
                          </td>
                          <td>
                            <strong>{empty ? "—" : score}</strong>
                          </td>
                          <td>
                            {empty ? (
                              <span className="small muted">—</span>
                            ) : (
                              <Badge tone={gradeTone(gradeFor(score))}>{gradeFor(score)}</Badge>
                            )}
                          </td>
                          <td>
                            {assessment ? (
                              <Badge
                                tone={
                                  assessment.status === "Approved"
                                    ? TONE.green
                                    : assessment.status === "Pending Approval"
                                      ? TONE.amber
                                      : TONE.red
                                }
                              >
                                {assessment.status}
                              </Badge>
                            ) : (
                              <span className="small muted">Draft</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      <ConfirmModal
        open={confirmSubmit}
        title="Submit sheet for approval"
        message={
          <span>
            This sends <strong>{roster.length}</strong> result{roster.length === 1 ? "" : "s"} for{" "}
            <strong>{selectedClass?.className}</strong> · {subject} to the school admin. You can still edit and
            resubmit afterwards.
          </span>
        }
        confirmLabel="Save & submit"
        tone="primary"
        busy={busy === "submit"}
        onConfirm={submitSheet}
        onClose={() => setConfirmSubmit(false)}
      />
    </>
  );
}
