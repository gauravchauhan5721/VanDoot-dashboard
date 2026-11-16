"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  CircleCheck,
  Radio,
  TriangleAlert,
  Clock,
} from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import { useClock } from "@/hooks/useClock";
import { Panel, StatusBadge } from "@/components/ui";
import { NodeConsole } from "./media/NodeConsole";
import { Chart } from "@/components/Chart";
import { ForestMap } from "@/components/ForestMap";
import { NodeTable } from "@/components/NodeTable";
import { sensors } from "@/config/sensors";
import { ago } from "@/utils/format";
import { captureTime, isFresh } from "@/utils/telemetry";
export function Overview({ nodeId }: { nodeId?: string }) {
  const { data, settings } = useDashboard();
  const now = useClock();
  const [sensorId, setSensor] = useState("temperature");
  const priority = data.alerts
    .filter((a) => a.state !== "resolved" && a.severity !== "info")
    .sort(
      (a, b) =>
        (a.severity === "critical" ? 0 : 1) -
          (b.severity === "critical" ? 0 : 1) ||
        Date.parse(b.timestamp) - Date.parse(a.timestamp),
    );
  const node =
    data.nodes.find((n) => n.id === nodeId) ||
    data.nodes.find((n) => n.id === priority[0]?.nodeId) ||
    data.nodes[0];
  const latest =
    data.nodes
      .map((n) => n.lastSeen)
      .filter((t) => Number.isFinite(Date.parse(t)) && Date.parse(t) <= Math.max(now, Date.parse(data.timestamp) || 0))
      .sort()
      .at(-1) || "";
  const sensor = sensors.find((s) => s.id === sensorId)!;
  const history = data.history
    .filter(
      (p) =>
        p.nodeId === node?.id && Date.parse(p.timestamp) > now - 6 * 3600_000,
    )
    .map((p) =>
      settings.units === "imperial" && sensorId === "temperature"
        ? {
            ...p,
            readings: {
              ...p.readings,
              temperature: (p.readings.temperature * 9) / 5 + 32,
            },
          }
        : p,
    );
  return (
    <div className="control-room">
      <div className="mission-strip">
        <div>
          <Radio size={17} />
          <span>
            Environment
            <strong>
              {settings.mode === "demo" ? "Demo mode" : "Live mode"}
            </strong>
          </span>
        </div>
        <a href="#alerts?severity=critical">
          <TriangleAlert size={17} className="red" />
          <span>
            Open critical
            <strong>
              {priority.filter((a) => a.severity === "critical").length}
              <small>need review</small>
            </strong>
          </span>
        </a>
        <div>
          <CircleCheck size={17} />
          <span>
            Nodes online
            <strong>
              {
                data.nodes.filter(
                  (n) =>
                    n.status !== "offline" &&
                    (settings.mode === "demo" || isFresh(n.lastSeen, Math.max(now, Date.parse(data.timestamp) || 0))),
                ).length
              }
              <small>/ {data.nodes.length} total</small>
            </strong>
          </span>
        </div>
        <div title={captureTime(latest)}>
          <Clock size={17} />
          <span>
            Last telemetry
            <strong>
              {latest ? ago(latest) : "—"}
              <small>
                {settings.mode === "demo" ? "simulated" : "measured"}
              </small>
            </strong>
          </span>
        </div>
      </div>
      <div className="watch-toolbar">
        <div>
          <span className="eyebrow">FOREST CONTROL ROOM</span>
          <h2>Eyes on the forest.</h2>
        </div>
        <label>
          Watching{" "}
          <select
            aria-label="Overview node"
            value={node?.id || ""}
            onChange={(e) => {
              window.location.hash = `overview/${encodeURIComponent(e.target.value)}`;
            }}
          >
            {data.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.id} · {n.location.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="watch-grid">
        <div className="watch-camera">
          {node && (
            <NodeConsole
              key={`${settings.mode}-${node.id}`}
              nodeId={node.id}
              compact
            />
          )}
        </div>
        <Panel
          title="Needs attention"
          subtitle="Highest priority first"
          className="priority-panel"
          action={<span className="count-badge">{priority.length} open</span>}
        >
          <div className="priority-list">
            {priority.length ? (
              priority.slice(0, 4).map((a) => (
                <a
                  className={`priority-alert ${a.severity}`}
                  href={`#alerts/${encodeURIComponent(a.id)}`}
                  key={a.id}
                >
                  <div>
                    <StatusBadge status={a.severity} />
                    <span>{ago(a.timestamp)}</span>
                  </div>
                  <h3>{a.title}</h3>
                  <p>
                    {a.nodeId} · {a.message}
                  </p>
                  <strong>
                    Review evidence <ArrowUpRight size={16} />
                  </strong>
                </a>
              ))
            ) : (
              <div className="empty-events">
                <CircleCheck size={28} />
                <h3>No open alerts</h3>
                <p>Keep monitoring node status and data freshness.</p>
              </div>
            )}
          </div>
          <a className="priority-footer" href="#alerts">
            All alerts & filters <ArrowUpRight size={16} />
          </a>
        </Panel>
      </div>
      <div className="watch-lower">
        <Panel
          title="Sensor trends"
          subtitle={`${node?.id || "No node"} · last 6 hours`}
          action={
            <select
              aria-label="Trend sensor"
              value={sensorId}
              onChange={(e) => setSensor(e.target.value)}
            >
              {sensors
                .filter((s) => s.featured)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          }
        >
          <Chart
            data={history}
            sensor={sensorId}
            series={
              node
                ? [{ id: node.id, name: node.id, color: "var(--green)" }]
                : []
            }
            unit={
              sensorId === "temperature" && settings.units === "imperial"
                ? "°F"
                : sensor.unit
            }
          />
        </Panel>
        <ForestMap
          selected={node?.id}
          onSelect={(id) => {
            window.location.hash = `overview/${encodeURIComponent(id)}`;
          }}
        />
      </div>
      <Panel
        title="Node readiness"
        subtitle="Telemetry status across the watch area"
        action={
          <a href="#nodes" className="text-link">
            Manage nodes ↗
          </a>
        }
      >
        <NodeTable nodes={data.nodes} />
      </Panel>
    </div>
  );
}
