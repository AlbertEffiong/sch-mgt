"use client";

import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState, LoadingPanel } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import { PasswordChecklist } from "@/components/ui/PasswordChecklist";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { formatDate, readableError } from "@/lib/format";
import { useAsync, useDebouncedValue } from "@/lib/hooks";
import type { Student } from "@/lib/types";
import { isStrongPassword, PASSWORD_POLICY } from "@/lib/validation";

type Dialog =
  | { mode: "create" }
  | { mode: "edit"; student: Student }
  | { mode: "password"; student: Student }
  | null;

interface StudentForm {
  fullName: string;
  gender: "Male" | "Female";
  dob: string;
  currentClass: string;
  password: string;
  guardianName: string;
  guardianPhone: string;
  address: string;
}

const EMPTY_FORM: StudentForm = {
  fullName: "",
  gender: "Male",
  dob: "",
  currentClass: "",
  password: "",
  guardianName: "",
  guardianPhone: "",
  address: "",
};

export function StudentsManager() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [page, setPage] = useState(1);
  const debouncedQuery = useDebouncedValue(query, 300);

  const { data, error, loading, reload } = useAsync(
    () =>
      Promise.all([
        api.listStudents({
          q: debouncedQuery.trim() || undefined,
          currentClass: classFilter || undefined,
          page,
          limit: 10,
        }),
        api.listClasses(),
      ]),
    [debouncedQuery, classFilter, page],
  );

  const [dialog, setDialog] = useState<Dialog>(null);
  const [form, setForm] = useState<StudentForm>(EMPTY_FORM);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);

  const students = data?.[0];
  const classes = data?.[1] ?? [];

  function update<K extends keyof StudentForm>(key: K, value: StudentForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM, currentClass: classes[0]?.className || "" });
    setDialog({ mode: "create" });
  }

  function openEdit(student: Student) {
    setForm({
      fullName: student.fullName,
      gender: student.gender,
      dob: student.dob,
      currentClass: student.currentClass,
      password: "",
      guardianName: student.guardianName || "",
      guardianPhone: student.guardianPhone || "",
      address: student.address || "",
    });
    setDialog({ mode: "edit", student });
  }

  function openPassword(student: Student) {
    setPassword("");
    setDialog({ mode: "password", student });
  }

  async function saveStudent(event: FormEvent) {
    event.preventDefault();
    if (!dialog) return;
    if (dialog.mode === "create" && !isStrongPassword(form.password)) {
      toast.push(PASSWORD_POLICY, "error");
      return;
    }
    setBusy(true);
    try {
      if (dialog.mode === "edit") {
        await api.updateStudent(dialog.student.id, {
          fullName: form.fullName.trim(),
          gender: form.gender,
          dob: form.dob,
          currentClass: form.currentClass,
          guardianName: form.guardianName.trim(),
          guardianPhone: form.guardianPhone.trim(),
          address: form.address.trim(),
        });
        toast.push(`${form.fullName} updated.`);
      } else {
        const created = await api.enrollStudent({
          fullName: form.fullName.trim(),
          gender: form.gender,
          dob: form.dob,
          currentClass: form.currentClass,
          password: form.password,
          guardianName: form.guardianName.trim() || undefined,
          guardianPhone: form.guardianPhone.trim() || undefined,
          address: form.address.trim() || undefined,
        });
        toast.push(`Student enrolled with ID ${created.studentId}.`);
      }
      setDialog(null);
      reload();
    } catch (reason) {
      toast.push(readableError(reason), "error");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    if (dialog?.mode !== "password") return;
    if (!isStrongPassword(password)) {
      toast.push(PASSWORD_POLICY, "error");
      return;
    }
    setBusy(true);
    try {
      await api.resetStudentPassword(dialog.student.id, password);
      toast.push(`Password reset for ${dialog.student.fullName}.`);
      setDialog(null);
    } catch (reason) {
      toast.push(readableError(reason), "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeStudent() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.deleteStudent(deleteTarget.id);
      toast.push(`${deleteTarget.fullName} removed.`);
      setDeleteTarget(null);
      reload();
    } catch (reason) {
      toast.push(readableError(reason), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Student enrollment"
        description="Every learner gets a unique admission ID in the format SCHOOL/YEAR/SEQUENCE."
        actions={
          <div className="row">
            <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={reload} loading={loading}>
              Refresh
            </Button>
            <Button icon={<UserPlus size={16} />} onClick={openCreate} disabled={classes.length === 0}>
              Enroll student
            </Button>
          </div>
        }
      />

      {classes.length === 0 ? (
        <div style={{ marginBottom: 18 }}>
          <Notice tone="warn">
            Create at least one class before enrolling students.{" "}
            <a href="/admin/classes">Open classes</a>.
          </Notice>
        </div>
      ) : null}

      <Card bodyClassName="">
        <div className="filter-bar" style={{ padding: "16px 18px" }}>
          <div className="search-box">
            <Search size={15} />
            <input
              className="input"
              placeholder="Search name or admission ID…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            className="select"
            value={classFilter}
            onChange={(event) => {
              setClassFilter(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by class"
          >
            <option value="">All classes</option>
            {classes.map((item) => (
              <option key={item.id} value={item.className}>
                {item.className}
              </option>
            ))}
          </select>
          <span className="small muted">
            {students?.total ?? 0} student{students?.total === 1 ? "" : "s"}
          </span>
        </div>

        {error ? (
          <div style={{ padding: 18 }}>
            <Notice tone="danger">{readableError(error)}</Notice>
          </div>
        ) : null}

        {loading && !data ? (
          <LoadingPanel label="Loading students…" />
        ) : !students || students.items.length === 0 ? (
          <EmptyState
            title="No students match this filter"
            description="Adjust your search or enroll a new student."
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Admission ID</th>
                    <th>Class</th>
                    <th>Guardian</th>
                    <th>Enrolled</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
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
                            <span>
                              {student.gender} · {formatDate(student.dob)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="mono">{student.studentId}</td>
                      <td>
                        <Badge tone="brand">{student.currentClass}</Badge>
                      </td>
                      <td className="small">
                        {student.guardianName || "—"}
                        {student.guardianPhone ? <div className="muted">{student.guardianPhone}</div> : null}
                      </td>
                      <td className="nowrap">{formatDate(student.createdAt)}</td>
                      <td>
                        <div className="table-actions">
                          <Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={() => openEdit(student)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="secondary" icon={<KeyRound size={14} />} onClick={() => openPassword(student)}>
                            Password
                          </Button>
                          <Button
                            size="sm"
                            variant="soft-danger"
                            icon={<Trash2 size={14} />}
                            onClick={() => setDeleteTarget(student)}
                          >
                            Remove
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <span>
                Page {students.page} of {Math.max(students.totalPages, 1)} · {students.total} total
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
                  disabled={!students.hasNext}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Modal
        open={dialog?.mode === "create" || dialog?.mode === "edit"}
        title={dialog?.mode === "edit" ? "Edit student" : "Enroll student"}
        subtitle={
          dialog?.mode === "edit"
            ? "Update contact details and class placement."
            : "A unique admission ID is generated automatically on save."
        }
        onClose={() => setDialog(null)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form="student-form" loading={busy} icon={<Plus size={16} />}>
              {dialog?.mode === "edit" ? "Save changes" : "Enroll student"}
            </Button>
          </>
        }
      >
        <form id="student-form" className="form-stack" onSubmit={saveStudent}>
          <div className="form-grid">
            <Field label="Full name" htmlFor="student-name" className="span-2">
              <Input
                id="student-name"
                value={form.fullName}
                onChange={(event) => update("fullName", event.target.value)}
                placeholder="Chiamaka Okafor"
                required
                minLength={2}
              />
            </Field>
            <Field label="Gender" htmlFor="student-gender">
              <Select
                id="student-gender"
                value={form.gender}
                onChange={(event) => update("gender", event.target.value as StudentForm["gender"])}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </Select>
            </Field>
            <Field label="Date of birth" htmlFor="student-dob">
              <Input
                id="student-dob"
                type="date"
                value={form.dob}
                onChange={(event) => update("dob", event.target.value)}
                required
              />
            </Field>
            <Field label="Class" htmlFor="student-class">
              <Select
                id="student-class"
                value={form.currentClass}
                onChange={(event) => update("currentClass", event.target.value)}
                required
              >
                <option value="">Select class</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.className}>
                    {item.className}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Guardian name" htmlFor="student-guardian">
              <Input
                id="student-guardian"
                value={form.guardianName}
                onChange={(event) => update("guardianName", event.target.value)}
                placeholder="Parent / guardian"
              />
            </Field>
            <Field label="Guardian phone" htmlFor="student-phone">
              <Input
                id="student-phone"
                value={form.guardianPhone}
                onChange={(event) => update("guardianPhone", event.target.value)}
                placeholder="0803 000 0000"
              />
            </Field>
            <Field label="Home address" htmlFor="student-address">
              <Input
                id="student-address"
                value={form.address}
                onChange={(event) => update("address", event.target.value)}
                placeholder="12 Unity Road, Lagos"
              />
            </Field>
          </div>

          {dialog?.mode === "create" ? (
            <Field label="Student portal password" htmlFor="student-password" hint={PASSWORD_POLICY}>
              <Input
                id="student-password"
                type="password"
                value={form.password}
                onChange={(event) => update("password", event.target.value)}
                placeholder="Create a strong password"
                autoComplete="new-password"
                required
              />
              <PasswordChecklist value={form.password} />
            </Field>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={dialog?.mode === "password"}
        title="Reset student password"
        subtitle={dialog?.mode === "password" ? dialog.student.fullName : undefined}
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form="password-form" loading={busy} icon={<KeyRound size={16} />}>
              Reset password
            </Button>
          </>
        }
      >
        <form id="password-form" className="form-stack" onSubmit={resetPassword}>
          <Field label="New password" htmlFor="reset-password" hint={PASSWORD_POLICY}>
            <Input
              id="reset-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
            <PasswordChecklist value={password} />
          </Field>
        </form>
      </Modal>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Remove student"
        message={
          <span>
            <strong>{deleteTarget?.fullName}</strong> and all related assessment records will be permanently removed.
          </span>
        }
        confirmLabel="Remove student"
        busy={busy}
        onConfirm={removeStudent}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
