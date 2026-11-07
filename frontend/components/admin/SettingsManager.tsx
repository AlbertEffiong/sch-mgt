"use client";

import { CalendarDays, RefreshCw, Save, School as SchoolIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingPanel } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { TERMS } from "@/lib/constants";
import { formatDate, isSchoolActive, readableError } from "@/lib/format";
import { useAsync } from "@/lib/hooks";
import type { School, Term } from "@/lib/types";

export function SettingsManager() {
  const { refresh } = useAuth();
  const { data, error, loading, reload } = useAsync(() => api.getSchool(), []);

  if (loading && !data) return <LoadingPanel label="Loading school settings…" />;
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

  return (
    <>
      <PageHeader
        title="School settings"
        description="Keep your academic calendar accurate — report cards and score sheets use these values."
        actions={
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={reload} loading={loading}>
            Refresh
          </Button>
        }
      />

      <div className="grid sidebar-grid">
        <SettingsForm school={data} onSaved={() => Promise.all([reload(), refresh()])} />

        <Card title="School profile" subtitle="Managed by the platform owner at registration.">
          <div className="stack" style={{ gap: 14 }}>
            <div className="row-between">
              <span className="muted small">School name</span>
              <strong>{data.name}</strong>
            </div>
            <div className="row-between">
              <span className="muted small">Admin email</span>
              <span className="mono small">{data.email}</span>
            </div>
            <div className="row-between">
              <span className="muted small">Admission prefix</span>
              <Badge tone="brand">{data.uniqueSchoolPrefix}</Badge>
            </div>
            <div className="row-between">
              <span className="muted small">School ID</span>
              <span className="mono small">{data.id}</span>
            </div>
            <div className="divider" />
            <div className="row-between">
              <span className="muted small">Subscription</span>
              <Badge tone={isSchoolActive(data) ? "green" : "red"}>
                {isSchoolActive(data) ? "Active" : "Expired"}
              </Badge>
            </div>
            <div className="row-between">
              <span className="muted small">Expires</span>
              <strong>{formatDate(data.subscriptionExpiresAt)}</strong>
            </div>
            <div className="row-between">
              <span className="muted small">Registered</span>
              <strong>{formatDate(data.createdAt)}</strong>
            </div>
            <div className="notice notice-info">
              <SchoolIcon size={16} />
              <span className="small">
                Admission IDs use the prefix <strong>{data.uniqueSchoolPrefix}</strong> and cannot be changed here.
              </span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

function SettingsForm({ school, onSaved }: { school: School; onSaved: () => Promise<unknown> }) {
  const toast = useToast();
  const [principalName, setPrincipalName] = useState(school.principalName);
  const [session, setSession] = useState(school.academic.currentSession);
  const [term, setTerm] = useState<Term>(school.academic.currentTerm);
  const [termsPerSession, setTermsPerSession] = useState(String(school.academic.termsPerSession));
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.updateAcademicSetting({
        current_session: session.trim(),
        current_term: term,
        terms_per_session: Number(termsPerSession),
        principalName: principalName.trim(),
      });
      toast.push("Academic settings saved.");
      await onSaved();
    } catch (reason) {
      toast.push(readableError(reason), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Academic calendar" subtitle="Applies to every new broadsheet and report card.">
      <form className="form-stack" onSubmit={submit}>
        <Field label="Principal / head teacher" htmlFor="settings-principal" hint="Printed on report cards.">
          <Input
            id="settings-principal"
            value={principalName}
            onChange={(event) => setPrincipalName(event.target.value)}
            placeholder="Mrs. Adaeze Nwosu"
            required
          />
        </Field>

        <div className="form-grid">
          <Field label="Current session" htmlFor="settings-session">
            <Input
              id="settings-session"
              value={session}
              onChange={(event) => setSession(event.target.value)}
              placeholder="2025/2026"
              pattern="\d{4}/\d{4}"
              required
            />
          </Field>
          <Field label="Current term" htmlFor="settings-term">
            <Select id="settings-term" value={term} onChange={(event) => setTerm(event.target.value as Term)}>
              {TERMS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Terms per session" htmlFor="settings-terms">
            <Select
              id="settings-terms"
              value={termsPerSession}
              onChange={(event) => setTermsPerSession(event.target.value)}
            >
              <option value="1">1 term</option>
              <option value="2">2 terms</option>
              <option value="3">3 terms</option>
            </Select>
          </Field>
        </div>

        <div className="notice notice-info">
          <CalendarDays size={16} />
          <span className="small">
            Changing the session or term does not alter results already submitted — they stay attached to their
            original period.
          </span>
        </div>

        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button type="submit" icon={<Save size={16} />} loading={busy}>
            Save settings
          </Button>
        </div>
      </form>
    </Card>
  );
}
