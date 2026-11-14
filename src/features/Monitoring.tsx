"use client";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  Cpu,
  Pause,
  Play,
  Radio,
  Server,
  Wifi,
} from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import {
  DetailGrid,
  KpiCard,
  Meter,
  Panel,
  StatusBadge,
} from "@/components/ui";
import { NetworkTopology } from "@/components/NetworkTopology";
import { SensorCards } from "@/components/SensorCards";
import { NodeTable } from "@/components/NodeTable";
import { Chart } from "@/components/Chart";
import { sensors } from "@/config/sensors";
import { ago, number } from "@/utils/format";
export function LiveMonitoring() {
  const { data, paused, setPaused, settings } = useDashboard();
  return (
    <>
      <div className="section-toolbar">
        <span className="live-label">
          <i />
          {paused
            ? "Updates paused"
            : `${settings.mode === "demo" ? "Simulated" : "Live"} telemetry stream`}
        </span>
        <button className="button" onClick={() => setPaused(!paused)}>
          {paused ? <Play size={15} /> : <Pause size={15} />}
          {paused ? "Resume updates" : "Pause updates"}
        </button>
      </div>
      <SensorCards />
      <div className="section-gap">
        <Panel
          title="Temperature stream"
          subtitle={`Refresh interval: ${settings.refreshInterval} seconds`}
        >
          <Chart
            data={data.history
              .filter(
                (p) => new Date(p.timestamp).getTime() > Date.now() - 3600000,
              )
              .map((p) =>
                settings.units === "imperial"
                  ? {
                      ...p,
                      readings: {
                        ...p.readings,
                        temperature: (p.readings.temperature * 9) / 5 + 32,
                      },
                    }
                  : p,
              )}
            series={data.nodes.map((n, i) => ({
              id: n.id,
              name: n.id,
              color: ["#b8e66c", "#63c9e7", "#a59bea"][i % 3],
            }))}
            height={260}
            unit={settings.units === "imperial" ? "°F" : "°C"}
          />
        </Panel>
      </div>
      <Panel title="Live node telemetry" className="section-gap">
        <NodeTable nodes={data.nodes} detailed />
      </Panel>
    </>
  );
}
export function NetworkPage() {
  const { data } = useDashboard();
  return (
    <>
      <div className="kpi-grid">
        <KpiCard
          label="Mesh devices"
          value={data.nodes.length + data.gateways.length}
          icon={<Cpu size={19} />}
          foot="Nodes + gateways"
        />
        <KpiCard
          label="Active links"
          value={data.links.filter((l) => l.status !== "offline").length}
          icon={<Wifi size={19} />}
          foot={`${data.links.length} configured links`}
        />
        <KpiCard
          label="Average RSSI"
          value={
            data.links.length
              ? (
                  data.links.reduce((a, l) => a + l.rssi, 0) / data.links.length
                ).toFixed(0)
              : "—"
          }
          suffix="dBm"
          icon={<Radio size={19} />}
          foot="Across all network links"
        />
        <KpiCard
          label="Routing"
          value="LoRaMesh"
          icon={<Activity size={19} />}
          foot="Multi-hop ready · Demo: 868 MHz"
        />
      </div>
      <Panel
        title="Interactive network topology"
        subtitle="Click any device to inspect it. Scroll controls to zoom; parent links define the routing tree."
      >
        <NetworkTopology large />
      </Panel>
      <Panel title="Routing & link quality" className="section-gap">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Source / parent</th>
                <th>Destination</th>
                <th>RSSI</th>
                <th>SNR</th>
                <th>Link quality</th>
                <th>Packets</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {data.links.map((l) => (
                <tr key={l.id}>
                  <td>{l.source}</td>
                  <td>
                    <a href={`#nodes/${l.target}`}>{l.target}</a>
                  </td>
                  <td>{l.rssi} dBm</td>
                  <td>{l.snr} dB</td>
                  <td>
                    <Meter label="" value={l.quality} />
                  </td>
                  <td>{number(l.traffic)}</td>
                  <td>
                    <StatusBadge status={l.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
export function GatewayPage() {
  const { data, settings } = useDashboard();
  return (
    <>
      {data.gateways.map((g) => (
        <div key={g.id}>
          <Panel
            title={`${g.name} · ${g.id}`}
            subtitle={`${g.model} · ${g.location.label}`}
            action={<StatusBadge status={g.status} />}
          >
            <div className="gateway-detail-layout">
              <div className="gateway-illustration">
                <Server size={70} strokeWidth={1} />
                <span>{g.model}</span>
                <small>{g.ip}</small>
                <span className="live-label">
                  <i />
                  {g.status}
                </span>
              </div>
              <div className="gateway-resources">
                <Meter label="CPU utilization" value={g.cpu} />
                <Meter
                  label="RAM utilization"
                  value={g.ram}
                  color="var(--cyan)"
                />
                <Meter
                  label="Storage utilization"
                  value={g.storage}
                  color="var(--purple)"
                />
                <Meter
                  label="CPU temperature"
                  value={(g.temperature / 85) * 100}
                  color="var(--amber)"
                  detail={`${g.temperature.toFixed(1)} °C`}
                />
              </div>
            </div>
            <DetailGrid
              items={[
                ["Gateway ID", g.id],
                ["IP address", g.ip],
                [
                  "Uptime",
                  `${Math.floor(g.uptime / 86400)} days, ${Math.floor((g.uptime % 86400) / 3600)} hours`,
                ],
                ["Last communication", ago(g.lastSeen)],
                [
                  "Network status",
                  g.status === "offline" ? "Disconnected" : "Connected",
                ],
                [
                  "LoRa module",
                  g.status === "offline" ? "Offline" : "Operational",
                ],
                [
                  "Connected nodes",
                  data.nodes.filter(
                    (n) => n.gatewayId === g.id && n.status !== "offline",
                  ).length,
                ],
                ["Packets received", number(g.received)],
                ["Packets transmitted", number(g.transmitted)],
                ["Packets lost", number(g.lost)],
                [
                  "Telemetry source",
                  settings.mode === "demo" ? "SIMULATED" : "Gateway API",
                ],
                [
                  "Control",
                  <a
                    key="control"
                    className="green"
                    href={`#device-control/${g.id}`}
                  >
                    Manage gateway →
                  </a>,
                ],
              ]}
            />
          </Panel>
          <Panel
            title="Gateway activity"
            subtitle="Latest telemetry received by this gateway"
            className="section-gap"
          >
            <div className="activity-list expanded">
              {data.logs
                .filter((l) =>
                  data.nodes.some(
                    (n) => n.id === l.nodeId && n.gatewayId === g.id,
                  ),
                )
                .slice(0, 8)
                .map((l) => (
                  <div key={l.id}>
                    <span className="activity-mark">
                      <ArrowDownLeft size={14} />
                    </span>
                    <div>
                      <strong>Packet received · {l.nodeId}</strong>
                      <span>
                        {l.sensor}: {l.value} {l.unit} · {l.id}
                      </span>
                    </div>
                    <small>{new Date(l.timestamp).toLocaleTimeString()}</small>
                  </div>
                ))}
            </div>
          </Panel>
        </div>
      ))}
    </>
  );
}
export function SensorsPage() {
  const { data, settings } = useDashboard();
  const [selected, setSelected] = useState("all");
  return (
    <>
      <SensorCards />
      <Panel
        title="Sensor registry"
        subtitle="Extensible definitions shared by every node and chart"
        className="section-gap"
        action={
          <select
            aria-label="Filter sensor node"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="all">All nodes</option>
            {data.nodes.map((n) => (
              <option key={n.id}>{n.id}</option>
            ))}
          </select>
        }
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Sensor</th>
                <th>Node</th>
                <th>Reading</th>
                <th>Unit</th>
                <th>Demo range</th>
                <th>Health</th>
                <th>History</th>
              </tr>
            </thead>
            <tbody>
              {data.nodes
                .filter((n) => selected === "all" || n.id === selected)
                .flatMap((node) =>
                  sensors.map((sensor) => {
                    const threshold = settings.thresholds[sensor.id];
                    const value = node.readings[sensor.id];
                    const bad =
                      threshold &&
                      (threshold.direction === "above"
                        ? value > threshold.warning
                        : value < threshold.warning);
                    return (
                      <tr key={`${node.id}-${sensor.id}`}>
                        <td>
                          <span className="inline-metric">
                            <i
                              style={{ background: sensor.color }}
                              className="legend-dot"
                            />
                            {sensor.name}
                          </span>
                        </td>
                        <td>{node.id}</td>
                        <td>{value?.toFixed(sensor.precision) ?? "—"}</td>
                        <td>{sensor.unit}</td>
                        <td className="muted">
                          {sensor.min} to {sensor.max}
                        </td>
                        <td>
                          <StatusBadge
                            status={
                              node.status === "offline"
                                ? "offline"
                                : bad
                                  ? "warning"
                                  : "healthy"
                            }
                          />
                        </td>
                        <td>
                          <a
                            className="green"
                            href={`#analytics/${sensor.id}/${node.id}`}
                          >
                            View chart →
                          </a>
                        </td>
                      </tr>
                    );
                  }),
                )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
export function SystemHealth() {
  const { data, database, wsStatus, settings, error } = useDashboard();
  const [backend, setBackend] = useState("Checking");
  useEffect(() => {
    fetch("/api/health")
      .then((r) => setBackend(r.ok ? "healthy" : "degraded"))
      .catch(() => setBackend("offline"));
  }, []);
  const demo = settings.mode === "demo";
  const services = [
    {
      name: "Dashboard",
      detail: "React application · Browser runtime",
      status: "healthy",
      icon: Activity,
    },
    {
      name: "Backend API",
      detail: "Next.js API healthcheck",
      status: backend,
      icon: Server,
    },
    {
      name: "PostgreSQL database",
      detail: "Settings, alerts, commands & reports",
      status: database ? "healthy" : "offline",
      icon: Server,
    },
    {
      name: "Gateway API",
      detail: demo
        ? "DEMO · Gateway service simulated"
        : settings.apiEndpoint || "No endpoint configured",
      status: demo ? "healthy" : error ? "offline" : "healthy",
      icon: Radio,
    },
    {
      name: "WebSocket",
      detail: demo ? "DEMO · Local simulation stream" : wsStatus,
      status: demo || wsStatus === "Connected" ? "healthy" : "offline",
      icon: Wifi,
    },
    ...data.gateways.map((g) => ({
      name: `${g.model} · ${g.id}`,
      detail: `${demo ? "DEMO · " : ""}${g.ip}`,
      status:
        g.status === "online"
          ? "healthy"
          : g.status === "weak"
            ? "degraded"
            : "offline",
      icon: Server,
    })),
    ...data.gateways.map((g) => ({
      name: `LoRa module · ${g.id}`,
      detail: demo ? "DEMO · SX1276 · 868 MHz" : "Status reported by gateway",
      status: g.status === "online" ? "healthy" : "degraded",
      icon: Radio,
    })),
    ...data.nodes.map((n) => ({
      name: n.id,
      detail: `${demo ? "DEMO · " : ""}${n.location.label}`,
      status:
        n.status === "online"
          ? "healthy"
          : n.status === "weak"
            ? "degraded"
            : "offline",
      icon: Cpu,
    })),
  ];
  return (
    <>
      <div className="health-banner">
        <HeartIcon />
        <div>
          <h2>
            {services.every((s) => s.status === "healthy")
              ? "All systems operational"
              : "Some services need attention"}
          </h2>
          <p>
            {services.filter((s) => s.status === "healthy").length} of{" "}
            {services.length} services healthy ·{" "}
            {demo
              ? "Hardware health is simulated in Demo Mode"
              : "Live service checks"}
          </p>
        </div>
        <span className="push live-label">
          <i />
          Monitoring
        </span>
      </div>
      <div className="three-column">
        {services.map((s) => (
          <Panel key={s.name}>
            <div className="health-service">
              <s.icon size={24} className="green" />
              <StatusBadge status={s.status} />
              <h3>{s.name}</h3>
              <p>{s.detail}</p>
              <div className="uptime-bars">
                {Array.from({ length: 30 }, (_, i) => (
                  <i
                    key={i}
                    className={s.status === "healthy" ? "healthy" : "unhealthy"}
                  />
                ))}
              </div>
              <small>
                {demo
                  ? "Demo status visualization · Not uptime history"
                  : "Current service status · Not uptime history"}
              </small>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
function HeartIcon() {
  return (
    <span className="health-large-icon">
      <Activity size={27} />
    </span>
  );
}
