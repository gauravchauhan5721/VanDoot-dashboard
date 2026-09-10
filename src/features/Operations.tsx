"use client";
import { useEffect, useState } from "react";
import {
  Download,
  FileChartColumn,
  LoaderCircle,
  Plus,
  Send,
  Terminal,
  TriangleAlert,
} from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import { CommandResult } from "@/types";
import { EmptyState, Modal, Panel, StatusBadge } from "@/components/ui";
import { sensors } from "@/config/sensors";
import { download } from "@/utils/format";
const commands = [
  "Ping Node",
  "Restart Node",
  "Request sensor reading",
  "Change sampling interval",
  "Change transmission interval",
  "Restart Gateway",
  "Send configuration",
  "Enable sensor",
  "Disable sensor",
];
export function DeviceControl({ targetId }: { targetId?: string }) {
  const { data, settings, sendCommand, notify } = useDashboard();
  const [target, setTarget] = useState(targetId || "");
  const [command, setCommand] = useState("Ping Node");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [history, setHistory] = useState<CommandResult[]>([]);
  const [error, setError] = useState("");
  const devices = [...data.nodes, ...data.gateways];
  const selectedTarget = target || devices[0]?.id || "";
  useEffect(() => {
    if (settings.mode !== "demo") {
      setHistory([]);
      return;
    }
    fetch("/api/commands")
      .then(async (r) => {
        if (!r.ok) throw new Error("Command history unavailable");
        setHistory(await r.json());
      })
      .catch((e) => setError(e.message));
  }, [settings.mode]);
  const submit = async () => {
    setConfirm(false);
    setBusy(true);
    setError("");
    try {
      const result = await sendCommand({
        target: selectedTarget,
        command,
        value,
      });
      setHistory((h) => [result, ...h].slice(0, 100));
      notify(result.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Command failed");
    } finally {
      setBusy(false);
    }
  };
  const requiresValue =
    command.includes("interval") ||
    (command.includes("sensor") &&
      (command.startsWith("Enable") || command.startsWith("Disable"))) ||
    command === "Send configuration";
  const validate = () => {
    if (!selectedTarget) {
      setError("Select a target device.");
      return;
    }
    const isGateway = data.gateways.some((g) => g.id === selectedTarget);
    if (
      (command === "Restart Gateway" && !isGateway) ||
      (command === "Restart Node" && isGateway)
    ) {
      setError("Choose the matching device type for this restart command.");
      return;
    }
    if (requiresValue && !value.trim()) {
      setError("Enter a command value.");
      return;
    }
    if (
      command.includes("interval") &&
      (!Number.isFinite(Number(value)) ||
        Number(value) < 1 ||
        Number(value) > 86400)
    ) {
      setError("Interval must be between 1 and 86,400 seconds.");
      return;
    }
    if (command === "Send configuration") {
      try {
        JSON.parse(value);
      } catch {
        setError("Configuration must be valid JSON.");
        return;
      }
    }
    if (command.includes("Restart") || settings.mode === "live")
      setConfirm(true);
    else void submit();
  };
  return (
    <>
      <div
        className={`info-banner ${settings.mode === "live" ? "warning-banner" : ""}`}
      >
        <Terminal size={19} />
        {settings.mode === "demo"
          ? "DEMO MODE · Commands are simulated and recorded. No command is sent to physical hardware."
          : "LIVE MODE · Commands are sent to your configured gateway. Confirm the target before proceeding."}
      </div>
      <div className="control-layout">
        <Panel
          title="Command center"
          subtitle="Communicate with a node or gateway"
        >
          <form
            className="settings-form"
            onSubmit={(e) => {
              e.preventDefault();
              validate();
            }}
          >
            <label>
              Target device
              <select
                value={selectedTarget}
                onChange={(e) => setTarget(e.target.value)}
              >
                {!devices.length && (
                  <option value="">No devices connected</option>
                )}
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.id} · {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Command
              <select
                value={command}
                onChange={(e) => {
                  setCommand(e.target.value);
                  setValue("");
                }}
              >
                {commands.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            {requiresValue && (
              <label>
                {command.includes("interval")
                  ? "Interval (seconds)"
                  : command === "Send configuration"
                    ? "Configuration JSON"
                    : "Sensor"}
                {command.includes("interval") ? (
                  <input
                    type="number"
                    min="1"
                    max="86400"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="30"
                  />
                ) : command === "Send configuration" ? (
                  <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={'{"samplingInterval": 30}'}
                  />
                ) : (
                  <select
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  >
                    <option value="">Choose sensor</option>
                    {sensors.map((s) => (
                      <option value={s.id} key={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            )}
            {error && <div className="form-error">{error}</div>}
            <button
              className="button primary"
              disabled={busy || !devices.length}
              type="submit"
            >
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Send size={16} />
              )}{" "}
              {busy
                ? "Processing…"
                : settings.mode === "demo"
                  ? "Simulate command"
                  : "Send live command"}
            </button>
          </form>
        </Panel>
        <Panel
          title="Command activity"
          subtitle={
            settings.mode === "demo"
              ? "Persistent simulation history"
              : "Commands sent in this session"
          }
        >
          {!history.length ? (
            <EmptyState
              title="Ready when you are"
              description="Run a command to see its result here."
            />
          ) : (
            <div className="command-history">
              {history.map((h) => (
                <div key={h.id}>
                  <span className="activity-mark">
                    <Terminal size={15} />
                  </span>
                  <div>
                    <strong>
                      {h.command} <span>→ {h.target}</span>
                    </strong>
                    <p>{h.message}</p>
                    <small>{new Date(h.createdAt).toLocaleString()}</small>
                  </div>
                  <StatusBadge status={h.status} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
      {confirm && (
        <Modal title="Confirm device command" onClose={() => setConfirm(false)}>
          <div className="modal-body">
            <TriangleAlert size={30} className="amber" />
            <h3>
              {command} → {selectedTarget}
            </h3>
            <p>
              {settings.mode === "demo"
                ? "This restart is simulated. Physical hardware will not be affected."
                : "This command will be submitted to your real gateway and may interrupt monitoring. Continue only if authorized."}
            </p>
            <div className="modal-actions">
              <button className="button" onClick={() => setConfirm(false)}>
                Cancel
              </button>
              <button className="button primary" onClick={() => void submit()}>
                {settings.mode === "demo"
                  ? "Confirm simulation"
                  : "Confirm live command"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
interface SavedReport {
  id: string;
  title: string;
  mode: string;
  createdAt: string;
  summary: {
    overview: Record<string, unknown>;
    sensors: Record<string, unknown>[];
    nodes: Record<string, unknown>[];
    gateways: Record<string, unknown>[];
  };
}
export function Reports() {
  const { data, settings, notify } = useDashboard();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("Network health summary");
  const [period, setPeriod] = useState(24);
  const [selected, setSelected] = useState<SavedReport | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/reports")
      .then(async (r) => {
        if (!r.ok)
          throw new Error("Report storage is unavailable. Check PostgreSQL.");
        setReports(await r.json());
      })
      .catch((e) => setError(e.message));
  }, []);
  const generate = async () => {
    if (!data.nodes.length) {
      notify(
        "Connect a gateway or enable Demo Mode before generating a report.",
      );
      return;
    }
    setBusy(true);
    try {
      const history = data.history.filter(
        (p) => new Date(p.timestamp).getTime() > Date.now() - period * 3600000,
      );
      const summary = {
        overview: {
          generated: new Date().toISOString(),
          periodHours: period,
          source: settings.mode,
          totalNodes: data.nodes.length,
          onlineNodes: data.nodes.filter((n) => n.status !== "offline").length,
          gatewayCount: data.gateways.length,
          activeAlerts: data.alerts.filter((a) => a.state === "active").length,
          criticalAlerts: data.alerts.filter(
            (a) => a.severity === "critical" && a.state !== "resolved",
          ).length,
          networkHealth: data.links.length
            ? (
                data.links.reduce((a, l) => a + l.quality, 0) /
                data.links.length
              ).toFixed(1)
            : 0,
          packetsReceived: data.gateways.reduce((a, g) => a + g.received, 0),
          packetsLost: data.gateways.reduce((a, g) => a + g.lost, 0),
        },
        sensors: sensors.map((s) => {
          const values = history
            .map((p) => p.readings[s.id])
            .filter(Number.isFinite);
          return {
            sensor: s.name,
            unit: s.unit,
            samples: values.length,
            min: values.length
              ? Math.min(...values).toFixed(s.precision)
              : "N/A",
            max: values.length
              ? Math.max(...values).toFixed(s.precision)
              : "N/A",
            average: values.length
              ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(
                  s.precision,
                )
              : "N/A",
          };
        }),
        nodes: data.nodes.map((n) => ({
          node: n.id,
          status: n.status,
          battery: n.readings.battery,
          rssi: n.readings.rssi,
          linkQuality: n.linkQuality,
          packetsSent: n.packets,
          packetsLost: n.lost,
        })),
        gateways: data.gateways.map((g) => ({
          gateway: g.id,
          status: g.status,
          cpu: g.cpu.toFixed(1),
          ram: g.ram.toFixed(1),
          temperature: g.temperature.toFixed(1),
          packetsReceived: g.received,
          packetsTransmitted: g.transmitted,
          packetsLost: g.lost,
        })),
      };
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, mode: settings.mode, summary }),
      });
      const report = await response.json();
      if (!response.ok) throw new Error(report.error);
      setReports((r) => [report, ...r]);
      setSelected(report);
      setError("");
      notify("Report generated and saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report generation failed");
    } finally {
      setBusy(false);
    }
  };
  const exportReport = (r: SavedReport) => {
    const rows: Record<string, unknown>[] = [
      {
        section: "Overview",
        item: r.title,
        data: JSON.stringify(r.summary.overview),
      },
      ...r.summary.sensors.map((s) => ({
        section: "Sensors",
        item: s.sensor,
        data: JSON.stringify(s),
      })),
      ...r.summary.nodes.map((n) => ({
        section: "Nodes",
        item: n.node,
        data: JSON.stringify(n),
      })),
      ...r.summary.gateways.map((g) => ({
        section: "Gateways",
        item: g.gateway,
        data: JSON.stringify(g),
      })),
    ];
    download(`vandoot-report-${r.id}.csv`, rows);
  };
  return (
    <>
      <Panel
        title="Create a report"
        subtitle="A saved snapshot of node, sensor, alert, gateway, and network health"
      >
        <form
          className="filter-bar report-form"
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
        >
          <label className="filter-label grow">
            Report title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={160}
            />
          </label>
          <label className="filter-label">
            Reporting period
            <select
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
            >
              <option value={1}>Last hour</option>
              <option value={24}>Last 24 hours</option>
              <option value={168}>Last 7 days</option>
              <option value={720}>Last 30 days</option>
            </select>
          </label>
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <Plus size={15} />
            )}
            Generate report
          </button>
        </form>
        {error && <p className="form-error padded">{error}</p>}
      </Panel>
      <Panel
        title="Saved reports"
        subtitle="Stored in PostgreSQL · Export anytime"
        className="section-gap"
      >
        {!reports.length ? (
          <EmptyState
            title="Your first report starts here"
            description="Generate a report to capture your network’s current health."
          />
        ) : (
          <div className="report-list">
            {reports.map((r) => (
              <div key={r.id}>
                <span className="report-icon">
                  <FileChartColumn size={23} />
                </span>
                <button onClick={() => setSelected(r)}>
                  <strong>{r.title}</strong>
                  <small>
                    {new Date(r.createdAt).toLocaleString()} ·{" "}
                    {r.summary.overview.periodHours as number} hour window
                  </small>
                </button>
                <span className="demo-tag">{r.mode.toUpperCase()}</span>
                <button className="button" onClick={() => exportReport(r)}>
                  <Download size={14} />
                  Export
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <div className="modal-body">
            <span className="demo-tag">
              {selected.mode.toUpperCase()} REPORT
            </span>
            <p>{new Date(selected.createdAt).toLocaleString()}</p>
            <div className="stat-list">
              {Object.entries(selected.summary.overview).map(([k, v]) => (
                <div key={k}>
                  <span>{k.replace(/([A-Z])/g, " $1")}</span>
                  <strong>{String(v)}</strong>
                </div>
              ))}
            </div>
            <h3>Sensor statistics</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Sensor</th>
                    <th>Min</th>
                    <th>Average</th>
                    <th>Max</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.summary.sensors.map((s) => (
                    <tr key={String(s.sensor)}>
                      <td>
                        {String(s.sensor)} <small>{String(s.unit)}</small>
                      </td>
                      <td>{String(s.min)}</td>
                      <td>{String(s.average)}</td>
                      <td>{String(s.max)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="button primary"
              onClick={() => exportReport(selected)}
            >
              <Download size={15} />
              Export complete report
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
