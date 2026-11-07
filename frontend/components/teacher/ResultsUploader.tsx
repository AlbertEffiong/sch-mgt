"use client";

import { CheckCircle2, FileSpreadsheet, Info, Upload, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, LoadingPanel } from "@/components/ui/EmptyState";
import { Field, Select } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { TERMS } from "@/lib/constants";
import { clamp } from "@/lib/grading";
import { readableError, isSubscriptionError } from "@/lib/format";
import { useAsync } from "@/lib/hooks";
import type { Term } from "@/lib/types";

interface ParsedRow {
  studentId: string;
  ca1: number;
  ca2: number;
  exam: number;
  name: string | null;
  valid: boolean;
}

function detectDelimiter(line: string): string {
  if (line.includes("\t")) return "\t";
  if (line.includes(";")) return ";";
  return ",";
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export function ResultsUploader() {
  const toast = useToast();
  const { user } = useAuth();
  const academic = user?.school?.academic;
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: classes, error: classesError, loading: classesLoading } = useAsync(() => api.teacherClasses(), []);
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");
  const [term, setTerm] = useState<Term>(academic?.currentTerm ?? "First Term");
  const [session, setSession] = useState(academic?.currentSession ?? "");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!classes || classes.length === 0) return;
    if (!classId || !classes.some((item) => item.id === classId)) setClassId(classes[0].id);
  }, [classes, classId]);

  const selectedClass = classes?.find((item) => item.id === classId) ?? null;

  useEffect(() => {
    if (!selectedClass) return;
    if (!selectedClass.subjects.includes(subject)) setSubject(selectedClass.subjects[0] ?? "");
  }, [selectedClass, subject]);

  const { data: roster, loading: rosterLoading } = useAsync(
    () => (classId ? api.roster(classId) : Promise.resolve([])),
    [classId],
  );

  const rosterMap = useMemo(
    () => new Map((roster ?? []).map((student) => [student.studentId.toUpperCase(), student])),
    [roster],
  );
  const validCount = parsed.filter((row) => row.valid).length;

  function reset() {
    setParsed([]);
    setParseError("");
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFile(file: File | undefined) {
    reset();
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setParseError("CSV files must be smaller than 2 MB.");
      return;
    }
    setFileName(file.name);
    const text = (await file.text()).replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
    if (lines.length < 2) {
      setParseError("The file needs a header row and at least one student row.");
      return;
    }
    const delimiter = detectDelimiter(lines[0]);
    const headers = lines[0].split(delimiter).map(normalizeHeader);
    const indexOf = (...names: string[]) => headers.findIndex((header) => names.includes(header));
    const idIndex = indexOf("studentid", "admissionid", "id");
    let ca1Index = indexOf("ca1", "ca");
    let ca2Index = indexOf("ca2");
    let examIndex = indexOf("exam", "examination");

    const hasHeader = idIndex !== -1;
    if (!hasHeader) {
      ca1Index = 1;
      ca2Index = 2;
      examIndex = 3;
    }
    if (hasHeader && (ca2Index === -1 || examIndex === -1)) {
      setParseError("Header must include studentId, ca1, ca2 and exam columns.");
      return;
    }

    const rows: ParsedRow[] = [];
    for (const line of lines.slice(hasHeader ? 1 : 0)) {
      const cells = line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ""));
      const studentId = hasHeader ? cells[idIndex] : cells[0];
      if (!studentId) continue;
      const match = rosterMap.get(studentId.toUpperCase());
      rows.push({
        studentId,
        ca1: clamp(cells[ca1Index] ?? "", 20),
        ca2: clamp(cells[ca2Index] ?? "", 20),
        exam: clamp(cells[examIndex] ?? "", 60),
        name: match?.fullName ?? null,
        valid: Boolean(match),
      });
    }

    if (rows.length === 0) {
      setParseError("No readable rows were found in the file.");
      return;
    }
    setParsed(rows);
  }

  async function importScores() {
    const entries = parsed.filter((row) => row.valid).map(({ studentId, ca1, ca2, exam }) => ({ studentId, ca1, ca2, exam }));
    if (entries.length === 0) {
      toast.push("No rows match students in this class.", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await api.saveBroadsheet({ classId, subject, term, session, entries });
      toast.push(`Imported ${result.saved} result${result.saved === 1 ? "" : "s"}. Review and submit from score entry.`);
      reset();
    } catch (reason) {
      toast.push(isSubscriptionError(reason) ? "Your school subscription has expired." : readableError(reason), "error");
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const header = "studentId,ca1,ca2,exam\n";
    const sample = (roster ?? [])
      .slice(0, 5)
      .map((student) => `${student.studentId},,,`)
      .join("\n");
    const blob = new Blob([header + sample], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selectedClass?.className ?? "class"}-${subject || "subject"}-template.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="Upload results"
        description="Import a CSV score sheet, then review and submit it from the score entry screen."
      />

      {classesError ? <Notice tone="danger">{readableError(classesError)}</Notice> : null}

      {classesLoading && !classes ? (
        <LoadingPanel label="Loading classes…" />
      ) : !classes || classes.length === 0 ? (
        <Card>
          <EmptyState title="No classes available" description="Ask your admin to set up classes first." />
        </Card>
      ) : (
        <div className="grid sidebar-grid">
          <div className="stack">
            <Card title="1 · Choose the sheet">
              <div className="form-grid">
                <Field label="Class" htmlFor="upload-class">
                  <Select
                    id="upload-class"
                    value={classId}
                    onChange={(event) => {
                      setClassId(event.target.value);
                      reset();
                    }}
                  >
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.className}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Subject" htmlFor="upload-subject">
                  <Select
                    id="upload-subject"
                    value={subject}
                    onChange={(event) => {
                      setSubject(event.target.value);
                      reset();
                    }}
                  >
                    {(selectedClass?.subjects ?? []).map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Term" htmlFor="upload-term">
                  <Select id="upload-term" value={term} onChange={(event) => setTerm(event.target.value as Term)}>
                    {TERMS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Session" htmlFor="upload-session">
                  <input
                    id="upload-session"
                    className="input"
                    value={session}
                    onChange={(event) => setSession(event.target.value)}
                    placeholder="2025/2026"
                  />
                </Field>
              </div>
            </Card>

            <Card title="2 · Upload the CSV" subtitle="Required columns: studentId, ca1, ca2, exam.">
              <label className="upload-zone">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={(event) => onFile(event.target.files?.[0])}
                />
                <FileSpreadsheet size={26} />
                <strong>{fileName || "Click to choose a CSV file"}</strong>
                <span className="small muted">Maximum 2 MB · comma, semicolon or tab separated</span>
              </label>

              {parseError ? (
                <div style={{ marginTop: 12 }}>
                  <Notice tone="danger">{parseError}</Notice>
                </div>
              ) : null}

              {rosterLoading ? <p className="small muted">Loading class roster…</p> : null}

              {parsed.length > 0 ? (
                <>
                  <div className="row-between" style={{ marginTop: 16 }}>
                    <div className="row">
                      <Badge tone={validCount === parsed.length ? "green" : "amber"}>
                        {validCount}/{parsed.length} matched
                      </Badge>
                      {validCount < parsed.length ? <span className="small muted">Unmatched IDs are skipped.</span> : null}
                    </div>
                    <Button icon={<Upload size={16} />} loading={busy} disabled={validCount === 0} onClick={importScores}>
                      Import {validCount} score{validCount === 1 ? "" : "s"}
                    </Button>
                  </div>

                  <div className="table-wrap" style={{ marginTop: 12 }}>
                    <table className="data">
                      <thead>
                        <tr>
                          <th>Student ID</th>
                          <th>Student</th>
                          <th>CA1</th>
                          <th>CA2</th>
                          <th>Exam</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.slice(0, 100).map((row, index) => (
                          <tr key={`${row.studentId}-${index}`}>
                            <td className="mono">{row.studentId}</td>
                            <td>{row.name || <span className="muted">Not in class</span>}</td>
                            <td>{row.ca1}</td>
                            <td>{row.ca2}</td>
                            <td>{row.exam}</td>
                            <td>
                              {row.valid ? (
                                <span className="row" style={{ gap: 6, color: "var(--success)" }}>
                                  <CheckCircle2 size={14} /> Ready
                                </span>
                              ) : (
                                <span className="row" style={{ gap: 6, color: "var(--danger)" }}>
                                  <XCircle size={14} /> Skipped
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </Card>
          </div>

          <div className="stack">
            <Card title="Template" subtitle="Start from a correctly formatted file.">
              <p className="small muted">
                The template lists every student in {selectedClass?.className ?? "the class"} with blank score columns.
                Scores are clamped to CA1 ≤ 20, CA2 ≤ 20 and exam ≤ 60.
              </p>
              <Button variant="secondary" icon={<FileSpreadsheet size={16} />} onClick={downloadTemplate}>
                Download template
              </Button>
            </Card>

            <Card title="After importing">
              <div className="stack" style={{ gap: 12 }}>
                <div className="row" style={{ alignItems: "flex-start", gap: 10 }}>
                  <Info size={16} color="var(--brand)" />
                  <span className="small">Imported scores are saved as a draft and are not visible to students.</span>
                </div>
                <div className="row" style={{ alignItems: "flex-start", gap: 10 }}>
                  <CheckCircle2 size={16} color="var(--success)" />
                  <span className="small">
                    Open <strong>Score entry</strong> to review the sheet, then submit it for admin approval.
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
