"use client";
import { useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Search,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import {
  EmptyState,
  KpiCard,
  Modal,
  Panel,
  StatusBadge,
} from "@/components/ui";
import { Alert } from "@/types";
import { AlertEvidence } from "./media/AlertEvidence";
export function Alerts({
  alertId,
  queryString = "",
}: {
  alertId?: string;
  queryString?: string;
}) {
  const { data, updateAlert } = useDashboard();
  const params = new URLSearchParams(queryString);
  const query = params.get("q") || "";
  const severity = params.get("severity") || "all";
  const state = params.get("state") || "all";
  const filter = (key: string, value: string) => {
    const next = new URLSearchParams(queryString);
    next.set(key, value);
    window.location.hash = `alerts?${next}`;
  };
  const [busy, setBusy] = useState(false);
  const filtered = data.alerts.filter(
    (a) =>
      `${a.title} ${a.nodeId} ${a.message}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (severity === "all" || a.severity === severity) &&
      (state === "all" || a.state === state),
  );
  const detail = data.alerts.find((a) => a.id === alertId);
  const act = async (a: Alert, next: Alert["state"]) => {
    setBusy(true);
    await updateAlert(a.id, next);
    setBusy(false);
  };
  return (
    <>
      <div className="kpi-grid">
        <KpiCard
          label="Active alerts"
          value={data.alerts.filter((a) => a.state === "active").length}
          icon={<Bell size={18} />}
          foot="Unacknowledged events"
        />
        <KpiCard
          label="Critical"
          value={
            data.alerts.filter(
              (a) => a.severity === "critical" && a.state !== "resolved",
            ).length
          }
          icon={<TriangleAlert size={18} />}
          color="red"
          foot="Immediate attention required"
        />
        <KpiCard
          label="Warnings"
          value={
            data.alerts.filter(
              (a) => a.severity === "warning" && a.state !== "resolved",
            ).length
          }
          icon={<TriangleAlert size={18} />}
          color="amber"
          foot="Review recommended"
        />
        <KpiCard
          label="Resolved"
          value={data.alerts.filter((a) => a.state === "resolved").length}
          icon={<ShieldCheck size={18} />}
          foot="Saved to your workspace"
        />
      </div>
      <Panel>
        <div className="filter-bar">
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Search alerts"
              placeholder="Search alerts or nodes…"
              value={query}
              onChange={(e) => filter("q", e.target.value)}
            />
          </label>
          <select
            aria-label="Alert severity"
            value={severity}
            onChange={(e) => filter("severity", e.target.value)}
          >
            <option value="all">All severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
          <select
            aria-label="Alert state"
            value={state}
            onChange={(e) => filter("state", e.target.value)}
          >
            <option value="all">All states</option>
            <option value="active">Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
          <a className="button push" href="#settings">
            Configure thresholds
          </a>
        </div>
        {!filtered.length ? (
          <EmptyState
            title="You're all caught up"
            description="No alerts match your current filters."
          />
        ) : (
          <div className="alert-list">
            {filtered.map((a) => (
              <div className="full-alert" key={a.id}>
                <span
                  className={`alert-icon ${a.severity === "critical" ? "red" : a.severity === "warning" ? "amber" : "blue"}`}
                >
                  {a.severity === "info" ? (
                    <Bell size={19} />
                  ) : (
                    <TriangleAlert size={19} />
                  )}
                </span>
                <div className="full-alert-copy">
                  <div>
                    <a
                      href={`#alerts/${encodeURIComponent(a.id)}${queryString ? `?${queryString}` : ""}`}
                      className="alert-title"
                    >
                      {a.title}
                    </a>
                    <StatusBadge status={a.severity} />
                  </div>
                  <p>{a.message}</p>
                  <small>
                    {a.nodeId} <span>·</span>{" "}
                    {new Date(a.timestamp).toLocaleString()} <span>·</span>{" "}
                    {a.state}
                  </small>
                </div>
                <div className="alert-actions">
                  {a.state === "active" && (
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => void act(a, "acknowledged")}
                    >
                      <Check size={14} />
                      Acknowledge
                    </button>
                  )}
                  {a.state !== "resolved" && (
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => void act(a, "resolved")}
                    >
                      <CheckCheck size={14} />
                      Resolve
                    </button>
                  )}
                  <a
                    className="text-link"
                    href={`#alerts/${encodeURIComponent(a.id)}${queryString ? `?${queryString}` : ""}`}
                  >
                    Details →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      {alertId && !detail && (
        <Panel>
          <EmptyState
            title="Evidence unavailable in this session"
            description="This event is no longer in the received event history. Load its saved incident record, or return to alerts."
            action={
              <a className="button" href="#forest/incidents">
                Open incident review
              </a>
            }
          />
        </Panel>
      )}
      {detail && (
        <Modal
          title="Alert details"
          onClose={() => {
            if (window.history.state?.vandootEvidence) window.history.back();
            else
              window.location.hash = `alerts${queryString ? `?${queryString}` : ""}`;
          }}
        >
          <div className="modal-body">
            <AlertEvidence key={detail.id} alert={detail} />
            <div className="modal-actions">
              {detail.state === "active" && (
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => void act(detail, "acknowledged")}
                >
                  Acknowledge
                </button>
              )}
              {detail.state !== "resolved" && (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void act(detail, "resolved")}
                >
                  Resolve alert
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
