"use client";

import { BookOpen, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SubjectsPicker } from "@/components/admin/SubjectsPicker";
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
import { readableError } from "@/lib/format";
import { useAsync } from "@/lib/hooks";
import type { SchoolClass } from "@/lib/types";

type EditorState = { mode: "create" } | { mode: "edit"; item: SchoolClass } | null;

const EMPTY_FORM = { className: "", subjects: [] as string[], teacherEmail: "" };

export function ClassesManager() {
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(
    () => Promise.all([api.listClasses(), api.listTeachers({ limit: 100 })]),
    [],
  );
  const [editor, setEditor] = useState<EditorState>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SchoolClass | null>(null);

  const classes = data?.[0] ?? [];
  const teachers = data?.[1]?.items ?? [];

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditor({ mode: "create" });
  }

  function openEdit(item: SchoolClass) {
    setForm({ className: item.className, subjects: item.subjects, teacherEmail: item.teacherEmail || "" });
    setEditor({ mode: "edit", item });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (form.subjects.length === 0) {
      toast.push("Add at least one subject to the class.", "error");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        className: form.className.trim(),
        subjects: form.subjects,
        teacherEmail: form.teacherEmail || undefined,
      };
      if (editor?.mode === "edit") {
        await api.updateClass(editor.item.id, payload);
        toast.push(`${payload.className} updated.`);
      } else {
        await api.createClass(payload);
        toast.push(`${payload.className} created.`);
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
      await api.deleteClass(deleteTarget.id);
      toast.push(`${deleteTarget.className} deleted.`);
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
        title="Classes & subjects"
        description="Define the curriculum every teacher sees when entering results."
        actions={
          <div className="row">
            <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={reload} loading={loading}>
              Refresh
            </Button>
            <Button icon={<Plus size={16} />} onClick={openCreate}>
              New class
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
          <LoadingPanel label="Loading classes…" />
        ) : classes.length === 0 ? (
          <EmptyState
            title="No classes yet"
            description="Create your first class and attach the subjects taught in it."
            action={
              <Button icon={<Plus size={16} />} onClick={openCreate}>
                Create a class
              </Button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Subjects</th>
                  <th>Form teacher</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="person">
                        <span className="avatar">
                          <BookOpen size={16} />
                        </span>
                        <div className="person-text">
                          <strong>{item.className}</strong>
                          <span>{item.subjects.length} subject{item.subjects.length === 1 ? "" : "s"}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="chip-list">
                        {item.subjects.map((subject) => (
                          <span key={subject} className="chip">
                            {subject}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {item.teacherEmail ? (
                        <span className="small">{item.teacherEmail}</span>
                      ) : (
                        <Badge tone="gray">Unassigned</Badge>
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        <Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={() => openEdit(item)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="soft-danger"
                          icon={<Trash2 size={14} />}
                          onClick={() => setDeleteTarget(item)}
                        >
                          Delete
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

      <Modal
        open={editor !== null}
        title={editor?.mode === "edit" ? "Edit class" : "Create class"}
        subtitle="Subjects are synced instantly to the teacher score-entry screen."
        onClose={() => setEditor(null)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditor(null)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form="class-form" loading={busy}>
              {editor?.mode === "edit" ? "Save changes" : "Create class"}
            </Button>
          </>
        }
      >
        <form id="class-form" className="form-stack" onSubmit={save}>
          <div className="form-grid">
            <Field label="Class name" htmlFor="class-name">
              <Input
                id="class-name"
                value={form.className}
                onChange={(event) => setForm((current) => ({ ...current, className: event.target.value }))}
                placeholder="JSS1"
                required
                minLength={2}
                maxLength={40}
              />
            </Field>
            <Field label="Form teacher" htmlFor="class-teacher" hint="Optional. Teachers must already be invited.">
              <Select
                id="class-teacher"
                value={form.teacherEmail}
                onChange={(event) => setForm((current) => ({ ...current, teacherEmail: event.target.value }))}
              >
                <option value="">No form teacher</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.email}>
                    {teacher.name} ({teacher.email})
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Subjects" hint="Add every subject offered in this class.">
            <SubjectsPicker
              value={form.subjects}
              onChange={(subjects) => setForm((current) => ({ ...current, subjects }))}
            />
          </Field>
        </form>
      </Modal>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete class"
        message={
          <span>
            <strong>{deleteTarget?.className}</strong> will be removed. Classes with enrolled students cannot be
            deleted.
          </span>
        }
        confirmLabel="Delete class"
        busy={busy}
        onConfirm={remove}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
