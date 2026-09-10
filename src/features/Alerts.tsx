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
export function Alerts({ alertId }: { alertId?: string }) {
  const { data, updateAlert } = useDashboard();
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [state, setState] = useState("all");
  const [selected, setSelected] = useState<string | null>(alertId || null);
  const [busy, setBusy] = useState(false);
  const filtered = data.alerts.filter(
    (a) =>
      `${a.title} ${a.nodeId} ${a.message}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (severity === "all" || a.severity === severity) &&
      (state === "all" || a.state === state),
  );
  const detail = data.alerts.find((a) => a.id === selected);
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
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Alert severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            <option value="all">All severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
          <select
            aria-label="Alert state"
            value={state}
            onChange={(e) => setState(e.target.value)}
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
                    <button
                      onClick={() => setSelected(a.id)}
                      className="alert-title"
                    >
                      {a.title}
                    </button>
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
                  <button
                    className="text-link"
                    onClick={() => setSelected(a.id)}
                  >
                    Details →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      {detail && (
        <Modal title="Alert details" onClose={() => setSelected(null)}>
          <div className="modal-body">
            <StatusBadge status={detail.severity} />
            <h3>{detail.title}</h3>
            <p>{detail.message}</p>
            <div className="stat-list">
              <div>
                <span>Device</span>
                <a href={`#nodes/${detail.nodeId}`}>{detail.nodeId}</a>
              </div>
              <div>
                <span>Timestamp</span>
                <strong>{new Date(detail.timestamp).toLocaleString()}</strong>
              </div>
              <div>
                <span>Status</span>
                <StatusBadge status={detail.state} />
              </div>
            </div>
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
