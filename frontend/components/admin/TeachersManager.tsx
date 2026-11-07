"use client";

import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  MailPlus,
  Pencil,
  RefreshCw,
  Trash2,
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
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { formatDate, readableError } from "@/lib/format";
import { useAsync } from "@/lib/hooks";
import type { Teacher, TeacherStatus } from "@/lib/types";

type Editor = { mode: "invite" } | { mode: "edit"; teacher: Teacher } | null;

const STATUS_TONE: Record<TeacherStatus, "green" | "amber" | "gray"> = {
  Active: "green",
  "On Leave": "amber",
  Inactive: "gray",
};

export function TeachersManager() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAsync(() => api.listTeachers({ page, limit: 10 }), [page]);

  const [editor, setEditor] = useState<Editor>(null);
  const [form, setForm] = useState({ name: "", email: "", subject: "", status: "Active" as TeacherStatus });
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);

  function openInvite() {
    setForm({ name: "", email: "", subject: "", status: "Active" });
    setEditor({ mode: "invite" });
  }

  function openEdit(teacher: Teacher) {
    setForm({ name: teacher.name, email: teacher.email, subject: teacher.subject || "", status: teacher.status });
    setEditor({ mode: "edit", teacher });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editor) return;
    setBusy(true);
    try {
      if (editor.mode === "invite") {
        const result = await api.inviteTeacher({
          name: form.name.trim(),
          email: form.email.trim(),
          subject: form.subject.trim() || undefined,
        });
        toast.push(
          result.otp
            ? `Invited ${result.teacher.email}. Demo activation code: ${result.otp}`
            : `Invitation sent to ${result.teacher.email}.`,
        );
      } else {
        await api.updateTeacher(editor.teacher.id, {
          name: form.name.trim(),
          subject: form.subject.trim(),
          status: form.status,
        });
        toast.push(`${form.name} updated.`);
      }
      setEditor(null);
      reload();
    } catch (reason) {
      toast.push(readableError(reason), "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.deleteTeacher(deleteTarget.id);
      toast.push(`${deleteTarget.name} removed.`);
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
        title="Teachers"
        description="Invite teachers, assign their primary subject and control portal access."
        actions={
          <div className="row">
            <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={reload} loading={loading}>
              Refresh
            </Button>
            <Button icon={<MailPlus size={16} />} onClick={openInvite}>
              Invite teacher
            </Button>
          </div>
        }
      />

      <Card bodyClassName="">
        {error ? (
          <div style={{ padding: 18 }}>
            <Notice tone="danger">{readableError(error)}</Notice>
          </div>
        ) : null}

        {loading && !data ? (
          <LoadingPanel label="Loading teachers…" />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="No teachers invited"
            description="Invited teachers receive an activation code before they can sign in."
            action={
              <Button icon={<MailPlus size={16} />} onClick={openInvite}>
                Invite your first teacher
              </Button>
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Teacher</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Activation</th>
                    <th>Invited</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((teacher) => (
                    <tr key={teacher.id}>
                      <td>
                        <div className="person">
                          <span className="avatar">
                            <GraduationCap size={16} />
                          </span>
                          <div className="person-text">
                            <strong>{teacher.name}</strong>
                            <span>{teacher.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>{teacher.subject || <span className="muted">Not assigned</span>}</td>
                      <td>
                        <Badge tone={STATUS_TONE[teacher.status]}>{teacher.status}</Badge>
                      </td>
                      <td>
                        <Badge tone={teacher.verified ? "green" : "amber"}>
                          {teacher.verified ? "Activated" : "Pending OTP"}
                        </Badge>
                      </td>
                      <td className="nowrap">{formatDate(teacher.createdAt)}</td>
                      <td>
                        <div className="table-actions">
                          <Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={() => openEdit(teacher)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="soft-danger"
                            icon={<Trash2 size={14} />}
                            onClick={() => setDeleteTarget(teacher)}
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
                <Button size="sm" variant="secondary" disabled={!data.hasNext} onClick={() => setPage((value) => value + 1)}>
                  Next <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Modal
        open={editor !== null}
        title={editor?.mode === "edit" ? "Edit teacher" : "Invite teacher"}
        subtitle={
          editor?.mode === "edit"
            ? "Update the teacher profile and portal access."
            : "The teacher activates their account with the code shown after saving."
        }
        onClose={() => setEditor(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditor(null)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form="teacher-form" loading={busy} icon={<MailPlus size={16} />}>
              {editor?.mode === "edit" ? "Save changes" : "Send invitation"}
            </Button>
          </>
        }
      >
        <form id="teacher-form" className="form-stack" onSubmit={submit}>
          <Field label="Full name" htmlFor="teacher-name">
            <Input
              id="teacher-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
              minLength={2}
            />
          </Field>
          <Field label="Email address" htmlFor="teacher-email" hint="Used for sign-in and activation.">
            <Input
              id="teacher-email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              disabled={editor?.mode === "edit"}
              required
            />
          </Field>
          <Field label="Primary subject" htmlFor="teacher-subject">
            <Input
              id="teacher-subject"
              value={form.subject}
              onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
              placeholder="Mathematics"
            />
          </Field>
          {editor?.mode === "edit" ? (
            <Field label="Portal status" htmlFor="teacher-status">
              <Select
                id="teacher-status"
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as TeacherStatus }))}
              >
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Inactive">Inactive</option>
              </Select>
            </Field>
          ) : null}
        </form>
      </Modal>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Remove teacher"
        message={
          <span>
            <strong>{deleteTarget?.name}</strong> will lose access immediately. Previously submitted results remain
            intact.
          </span>
        }
        confirmLabel="Remove teacher"
        busy={busy}
        onConfirm={remove}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
