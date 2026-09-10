"use client";
import { useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleCheck,
  Cpu,
  Network,
  Radio,
  Server,
  ShieldCheck,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import { KpiCard, Meter, PageLink, Panel } from "@/components/ui";
import { NetworkTopology } from "@/components/NetworkTopology";
import { SensorCards } from "@/components/SensorCards";
import { Chart } from "@/components/Chart";
import { NodeTable } from "@/components/NodeTable";
import { ago, number } from "@/utils/format";
const colors = ["#b7e580", "#66bcd2", "#b2a1e5", "#e8ad67", "#ef8099"];
export function Overview() {
  const { data, settings } = useDashboard();
  const [range, setRange] = useState(6);
  const [sensor, setSensor] = useState("temperature");
  const online = data.nodes.filter((n) => n.status !== "offline").length;
  const alerts = data.alerts.filter(
    (a) => a.state === "active" && a.severity !== "info",
  );
  const gateway = data.gateways[0];
  const packets = data.gateways.reduce((a, g) => a + g.received, 0);
  const lost = data.gateways.reduce((a, g) => a + g.lost, 0);
  const quality = data.links.length
    ? data.links.reduce((a, l) => a + l.quality, 0) / data.links.length
    : 0;
  const history = data.history
    .filter(
      (p) => new Date(p.timestamp).getTime() >= Date.now() - range * 3600000,
    )
    .map((p) =>
      settings.units === "imperial" && sensor === "temperature"
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
    <>
      <div className="kpi-grid">
        <KpiCard
          label="Total nodes"
          value={data.nodes.length.toString().padStart(2, "0")}
          icon={<Cpu size={18} />}
          foot={
            <>
              <span>
                <i className="green-dot" />
                {online} online
              </span>
              <span className="kpi-divider" />
              <span>
                <i className="gray-dot" />
                {data.nodes.length - online} offline
              </span>
            </>
          }
        />
        <KpiCard
          label="Gateway status"
          value={
            gateway
              ? gateway.status === "online"
                ? "Online"
                : "Degraded"
              : "Offline"
          }
          icon={<Server size={18} />}
          foot={
            <>
              <span className="green">
                <i className="green-dot" />
                {gateway?.model || "Not connected"}
              </span>
              <span className="push muted">{gateway?.id || "—"}</span>
            </>
          }
        />
        <KpiCard
          label="Network health"
          value={quality.toFixed(1)}
          suffix="%"
          icon={<Network size={18} />}
          spark={[9, 9, 14, 12, 20, 17, 16, 24, 23, 29, 27, 32]}
          foot={
            <>
              <ShieldCheck size={12} className="green" />
              <span>
                {quality >= 90
                  ? "All links operational"
                  : "Network needs attention"}
              </span>
              <span className="push positive">{data.links.length} links</span>
            </>
          }
        />
        <KpiCard
          label="Packets received"
          value={number(packets)}
          icon={<ArrowDownLeft size={19} />}
          color="cyan"
          spark={[4, 11, 9, 17, 12, 21, 19, 22, 17, 28, 25, 33]}
          foot={
            <>
              <span>
                Packet loss{" "}
                <b className="normal-text">
                  {((lost / Math.max(1, packets + lost)) * 100).toFixed(2)}%
                </b>
              </span>
              <span className="push positive">
                <ArrowUpRight size={12} /> Receiving
              </span>
            </>
          }
        />
      </div>
      <div className="overview-main-grid">
        <Panel
          title="LoRaMesh topology"
          subtitle="A live view of your connected network"
          action={<PageLink to="network">View network</PageLink>}
        >
          <NetworkTopology />
          <div className="panel-bottom">
            <span>
              <span className="status-dot" />
              {data.nodes.length} nodes connected
            </span>
            <span>
              <Radio size={13} />
              {data.gateways.length} gateway
              <span className="dot-separator">·</span>Mesh protocol active
            </span>
          </div>
        </Panel>
        <Panel
          title="Sensor overview"
          subtitle="Average readings across online nodes"
          action={
            <span className="live-label">
              <i />
              Live
            </span>
          }
        >
          <SensorCards compact />
          <div className="sensor-panel-footer">
            <CircleCheck size={14} />
            <span>Monitoring your environment, continuously.</span>
          </div>
        </Panel>
      </div>
      <div className="overview-main-grid second-row">
        <Panel
          title="Sensor trends"
          subtitle="Small changes. Meaningful insights."
          action={
            <select
              className="small-select"
              aria-label="Trend time range"
              value={range}
              onChange={(e) => setRange(Number(e.target.value))}
            >
              <option value={1}>Last 1 hour</option>
              <option value={6}>Last 6 hours</option>
              <option value={24}>Last 24 hours</option>
              <option value={168}>Last 7 days</option>
            </select>
          }
        >
          <div className="chart-tabs">
            {[
              ["temperature", "Temperature"],
              ["humidity", "Humidity"],
              ["pressure", "Pressure"],
              ["airQuality", "Air quality"],
            ].map(([id, name]) => (
              <button
                className={sensor === id ? "active" : ""}
                onClick={() => setSensor(id)}
                key={id}
              >
                {name}
              </button>
            ))}
          </div>
          <Chart
            data={history}
            sensor={sensor}
            series={data.nodes.map((n, i) => ({
              id: n.id,
              name: n.id,
              color: colors[i % colors.length],
            }))}
            height={190}
            unit={
              sensor === "temperature"
                ? settings.units === "imperial"
                  ? "°F"
                  : "°C"
                : sensor === "humidity"
                  ? "%"
                  : sensor === "pressure"
                    ? "hPa"
                    : "AQI"
            }
          />
        </Panel>
        <Panel
          title="Recent alerts"
          action={
            <a className="count-badge" href="#alerts">
              {alerts.length} active
              <ChevronDown size={11} />
            </a>
          }
        >
          <div className="recent-alerts">
            {data.alerts
              .filter((a) => a.state !== "resolved")
              .slice(0, 3)
              .map((a) => (
                <a href={`#alerts/${a.id}`} className="recent-alert" key={a.id}>
                  <span
                    className={`alert-icon ${a.severity === "info" ? "blue" : a.severity === "critical" ? "red" : "amber"}`}
                  >
                    {a.severity === "info" ? (
                      <Check size={16} />
                    ) : (
                      <TriangleAlert size={16} />
                    )}
                  </span>
                  <span className="alert-copy">
                    <strong>{a.title}</strong>
                    <span>
                      {a.nodeId} <i>·</i>{" "}
                      {a.severity === "info"
                        ? "Network event"
                        : a.severity === "critical"
                          ? "Requires attention"
                          : a.id.includes("signal")
                            ? "RSSI dropped below threshold"
                            : "Review sensor reading"}
                    </span>
                    <small>{ago(a.timestamp)}</small>
                  </span>
                  <i
                    className={`alert-dot ${a.severity === "info" ? "blue-dot" : a.severity === "critical" ? "red-dot" : "amber-dot"}`}
                  />
                </a>
              ))}
          </div>
          <div className="alerts-footer">
            <PageLink to="alerts">View all alerts</PageLink>
          </div>
        </Panel>
      </div>
      <Panel
        title="Connected nodes"
        subtitle="Your devices, working together."
        action={<PageLink to="nodes">Manage nodes</PageLink>}
        className="nodes-overview"
      >
        <NodeTable nodes={data.nodes} />
      </Panel>
      <div className="bottom-grid">
        <Panel
          title="Gateway health"
          action={<PageLink to="gateway">Details</PageLink>}
        >
          <div className="gateway-mini">
            <span className="device-icon">
              <Server size={23} />
            </span>
            <div>
              <strong>{gateway?.model || "No gateway"}</strong>
              <small>{gateway?.name}</small>
            </div>
            <span className="push live-label">
              <i />
              {gateway?.status || "Offline"}
            </span>
          </div>
          <div className="gateway-meters">
            <Meter label="CPU usage" value={gateway?.cpu || 0} />
            <Meter
              label="Memory"
              value={gateway?.ram || 0}
              color="var(--cyan)"
            />
            <Meter
              label="Storage"
              value={gateway?.storage || 0}
              color="var(--purple)"
            />
          </div>
        </Panel>
        <Panel
          title="Recent activity"
          action={<Activity size={15} className="muted" />}
        >
          <div className="activity-list">
            {data.logs
              .filter((l) => l.sensor === "temperature")
              .slice(0, 3)
              .map((l, i) => (
                <div key={l.id}>
                  <span className="activity-mark">
                    <Zap size={12} />
                  </span>
                  <div>
                    <strong>Telemetry received from {l.nodeId}</strong>
                    <span>Sensor data synchronized successfully</span>
                  </div>
                  <small>{i === 0 ? "Just now" : ago(l.timestamp)}</small>
                </div>
              ))}
          </div>
        </Panel>
        <Panel
          title="Network statistics"
          action={<Network size={15} className="muted" />}
        >
          <div className="stat-list">
            <div>
              <span>Average RSSI</span>
              <strong>
                {data.links.length
                  ? (
                      data.links.reduce((a, l) => a + l.rssi, 0) /
                      data.links.length
                    ).toFixed(0)
                  : "—"}{" "}
                <small>dBm</small>
              </strong>
            </div>
            <div>
              <span>Average SNR</span>
              <strong>
                {data.links.length
                  ? (
                      data.links.reduce((a, l) => a + l.snr, 0) /
                      data.links.length
                    ).toFixed(1)
                  : "—"}{" "}
                <small>dB</small>
              </strong>
            </div>
            <div>
              <span>Packets transmitted</span>
              <strong>
                {number(data.gateways.reduce((a, g) => a + g.transmitted, 0))}
              </strong>
            </div>
            <div>
              <span>Active alerts</span>
              <strong className="amber">
                {alerts.length} <small>need review</small>
              </strong>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
