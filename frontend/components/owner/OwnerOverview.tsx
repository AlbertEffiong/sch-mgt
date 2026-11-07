"use client";

import Link from "next/link";
import { AlertTriangle, Banknote, Building2, CheckCircle2, RefreshCw, Users } from "lucide-react";
import { useAsync } from "@/lib/hooks";
import { api } from "@/lib/api";
import { currency, formatDate, readableError, subscriptionLabel } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, LoadingPanel } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";

export function OwnerOverview() {
  const { data, error, loading, reload } = useAsync(
    () => Promise.all([api.ownerDashboard(), api.ownerSchools({ limit: 6 })]),
    [],
  );

  if (loading && !data) return <LoadingPanel label="Loading platform overview…" />;
  if (error && !data) {
    return (
      <Notice tone="danger">
        {readableError(error)} <button className="btn btn-sm btn-secondary" onClick={reload}>Retry</button>
      </Notice>
    );
  }
  if (!data) return null;

  const [stats, schools] = data;

  return (
    <>
      <PageHeader
        title="Platform overview"
        description="Monitor recurring revenue, school subscriptions and payment verifications."
        actions={
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={reload} loading={loading}>
            Refresh
          </Button>
        }
      />

      {stats.pendingPayments > 0 ? (
        <div style={{ marginBottom: 18 }}>
          <Notice tone="warn">
            <strong>{stats.pendingPayments} payment{stats.pendingPayments === 1 ? "" : "s"} awaiting verification.</strong>{" "}
            <Link href="/owner/payments">Open the payment queue</Link> to renew subscriptions.
          </Notice>
        </div>
      ) : null}

      <div className="grid four" style={{ marginBottom: 20 }}>
        <StatCard icon={<Banknote size={18} />} label="Monthly recurring revenue" value={currency(stats.mrr)} />
        <StatCard icon={<Building2 size={18} />} label="Schools on the platform" value={stats.totalSchools} />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label="Active subscriptions"
          value={stats.activeSchools}
          detail={`${stats.expiredSchools} expired`}
        />
        <StatCard
          icon={<Users size={18} />}
          label="Students enrolled"
          value={stats.totalStudents.toLocaleString()}
          detail={`${stats.pendingPayments} pending payment${stats.pendingPayments === 1 ? "" : "s"}`}
        />
      </div>

      <div className="grid sidebar-grid">
        <Card
          title="Recently registered schools"
          subtitle="The newest tenants across the platform."
          action={<Link href="/owner/schools" className="btn btn-secondary btn-sm">View all schools</Link>}
          bodyClassName=""
        >
          {schools.items.length === 0 ? (
            <EmptyState title="No schools yet" description="Schools will appear here after registration." />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>School</th>
                    <th>Prefix</th>
                    <th>Students</th>
                    <th>Expires</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {schools.items.map((school) => (
                    <tr key={school.id}>
                      <td>
                        <div className="person">
                          <span className="avatar">{school.uniqueSchoolPrefix.slice(0, 2)}</span>
                          <div className="person-text">
                            <strong>{school.name}</strong>
                            <span>{school.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="mono">{school.uniqueSchoolPrefix}</td>
                      <td>{school.studentCount ?? 0}</td>
                      <td className="nowrap">{formatDate(school.subscriptionExpiresAt)}</td>
                      <td>
                        <Badge tone={subscriptionLabel(school) === "Active" ? "green" : "red"}>
                          {subscriptionLabel(school)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="stack">
          <Card title="Revenue health">
            <div className="stack" style={{ gap: 12 }}>
              <div className="row-between">
                <span className="muted small">Active schools</span>
                <strong>{stats.activeSchools}</strong>
              </div>
              <div className="row-between">
                <span className="muted small">Expired schools</span>
                <strong>{stats.expiredSchools}</strong>
              </div>
              <div className="row-between">
                <span className="muted small">Avg. plan</span>
                <strong>{stats.activeSchools ? currency(stats.mrr / stats.activeSchools) : currency(0)}</strong>
              </div>
              <div className="divider" />
              <div className="row-between">
                <span className="muted small">Pending verifications</span>
                <Badge tone={stats.pendingPayments ? "amber" : "green"}>{stats.pendingPayments}</Badge>
              </div>
            </div>
          </Card>
          <Card title="Needs attention">
            {stats.pendingPayments > 0 ? (
              <div className="stack" style={{ gap: 10 }}>
                <div className="row">
                  <AlertTriangle size={18} color="var(--warning)" />
                  <span className="small">
                    {stats.pendingPayments} school{stats.pendingPayments === 1 ? "" : "s"} submitted transfer proof.
                  </span>
                </div>
                <Link href="/owner/payments" className="btn btn-primary btn-sm">
                  Review payments
                </Link>
              </div>
            ) : (
              <div className="row">
                <CheckCircle2 size={18} color="var(--success)" />
                <span className="small">All payment submissions are cleared.</span>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
