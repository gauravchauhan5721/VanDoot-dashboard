"use client";
import { useState } from "react";
import {
  Battery,
  Cpu,
  Grid2X2,
  List,
  Plus,
  Search,
  Signal,
} from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import {
  DetailGrid,
  EmptyState,
  Modal,
  PageLink,
  Panel,
  StatusBadge,
} from "@/components/ui";
import { NodeTable } from "@/components/NodeTable";
import { SensorCards } from "@/components/SensorCards";
import { Chart } from "@/components/Chart";
import { sensors } from "@/config/sensors";
import { ago, number } from "@/utils/format";
export function Nodes({ nodeId }: { nodeId?: string }) {
  const { data, settings } = useDashboard();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [grid, setGrid] = useState(false);
  const [add, setAdd] = useState(false);
  const node = data.nodes.find((n) => n.id === nodeId);
  if (nodeId) {
    if (!node)
      return (
        <Panel>
          <EmptyState
            title="Node not found"
            description="This node is not part of the current network."
            action={
              <a href="#nodes" className="button">
                Back to nodes
              </a>
            }
          />
        </Panel>
      );
    return (
      <>
        <div className="section-toolbar">
          <PageLink to="nodes">All nodes</PageLink>
          <a className="button" href={`#device-control/${node.id}`}>
            Control device
          </a>
        </div>
        <Panel
          title={node.id}
          subtitle={`${node.name} · ${node.location.label}`}
          action={<StatusBadge status={node.status} />}
        >
          <DetailGrid
            items={[
              ["Firmware", node.firmware],
              [
                "Uptime",
                `${Math.floor(node.uptime / 86400)}d ${Math.floor((node.uptime % 86400) / 3600)}h`,
              ],
              ["Last seen", ago(node.lastSeen)],
              ["Gateway", node.gatewayId],
              ["Parent node", node.parentId],
              ["Next hop", node.parentId],
              ["RSSI", `${node.readings.rssi} dBm`],
              ["SNR", `${node.readings.snr} dB`],
              ["Link quality", `${node.linkQuality}%`],
              ["Packets sent", number(node.packets)],
              ["Packets received", number(node.received)],
              ["Packets lost", number(node.lost)],
            ]}
          />
        </Panel>
        <div className="section-title">
          <h2>Sensor readings</h2>
          <span className="live-label">
            <i />
            Updating live
          </span>
        </div>
        <SensorCards nodeId={node.id} />
        <div className="section-title">
          <h2>Sensor history</h2>
          <span className="muted">Last 24 hours</span>
        </div>
        <div className="two-column">
          {sensors.map((sensor) => (
            <Panel title={sensor.name} key={sensor.id}>
              <Chart
                data={data.history
                  .filter(
                    (p) =>
                      p.nodeId === node.id &&
                      new Date(p.timestamp).getTime() > Date.now() - 86400000,
                  )
                  .map((p) =>
                    settings.units === "imperial" && sensor.id === "temperature"
                      ? {
                          ...p,
                          readings: {
                            ...p.readings,
                            temperature: (p.readings.temperature * 9) / 5 + 32,
                          },
                        }
                      : p,
                  )}
                sensor={sensor.id}
                series={[{ id: node.id, name: node.id, color: sensor.color }]}
                unit={
                  sensor.id === "temperature" && settings.units === "imperial"
                    ? "°F"
                    : sensor.unit
                }
              />
            </Panel>
          ))}
        </div>
        <div className="two-column section-gap">
          <Panel title="Node alerts">
            {data.alerts
              .filter((a) => a.nodeId === node.id)
              .map((a) => (
                <a
                  className="simple-list-row"
                  href={`#alerts/${a.id}`}
                  key={a.id}
                >
                  <div>
                    <strong>{a.title}</strong>
                    <small>{ago(a.timestamp)}</small>
                  </div>
                  <StatusBadge status={a.severity} />
                </a>
              ))}
            {!data.alerts.some((a) => a.nodeId === node.id) && (
              <EmptyState
                title="No alerts for this node"
                description="No threshold violations have been recorded."
              />
            )}
          </Panel>
          <Panel title="Recent events">
            {data.logs
              .filter((l) => l.nodeId === node.id)
              .slice(0, 5)
              .map((l) => (
                <div key={l.id} className="simple-list-row">
                  <div>
                    <strong>
                      {l.event} · {l.sensor}
                    </strong>
                    <small>{new Date(l.timestamp).toLocaleString()}</small>
                  </div>
                  <span>
                    {l.value} {l.unit}
                  </span>
                </div>
              ))}
          </Panel>
        </div>
      </>
    );
  }
  const filtered = data.nodes.filter(
    (n) =>
      `${n.id} ${n.name} ${n.location.label}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === "all" || n.status === status),
  );
  return (
    <>
      <div className="summary-strip">
        <span>
          <Cpu size={17} />
          <strong>{data.nodes.length}</strong> total nodes
        </span>
        <span>
          <i className="green-dot" />
          <strong>
            {data.nodes.filter((n) => n.status !== "offline").length}
          </strong>{" "}
          online
        </span>
        <span>
          <i className="amber-dot" />
          <strong>
            {data.nodes.filter((n) => n.status === "weak").length}
          </strong>{" "}
          weak links
        </span>
        <span>
          <i className="red-dot" />
          <strong>
            {data.nodes.filter((n) => n.status === "offline").length}
          </strong>{" "}
          offline
        </span>
      </div>
      <Panel>
        <div className="filter-bar">
          <label className="search-field">
            <Search size={16} />
            <input
              placeholder="Search nodes, locations…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Node status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="online">Online</option>
            <option value="weak">Weak link</option>
            <option value="offline">Offline</option>
          </select>
          <div className="push view-toggle">
            <button
              className={!grid ? "active" : ""}
              aria-label="Table view"
              onClick={() => setGrid(false)}
            >
              <List size={17} />
            </button>
            <button
              className={grid ? "active" : ""}
              aria-label="Card view"
              onClick={() => setGrid(true)}
            >
              <Grid2X2 size={17} />
            </button>
          </div>
          <button className="button primary" onClick={() => setAdd(true)}>
            <Plus size={15} />
            Add node
          </button>
        </div>
        {grid ? (
          <div className="node-card-grid">
            {filtered.map((n) => (
              <a href={`#nodes/${n.id}`} className="node-card" key={n.id}>
                <div>
                  <span className="device-icon">
                    <Cpu size={22} />
                  </span>
                  <StatusBadge status={n.status} />
                </div>
                <h3>{n.id}</h3>
                <p>{n.name}</p>
                <small>{n.location.label}</small>
                <div className="node-card-readings">
                  <span>
                    {(settings.units === "imperial"
                      ? (n.readings.temperature * 9) / 5 + 32
                      : n.readings.temperature
                    ).toFixed(1)}{" "}
                    {settings.units === "imperial" ? "°F" : "°C"}
                  </span>
                  <span>
                    <Battery size={15} />
                    {n.readings.battery}%
                  </span>
                  <span>
                    <Signal size={14} />
                    {n.readings.rssi} dBm
                  </span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <NodeTable nodes={filtered} detailed />
        )}
      </Panel>
      {add && (
        <Modal title="Add a sensor node" onClose={() => setAdd(false)}>
          <div className="modal-body">
            <h3>Configuration-driven discovery</h3>
            <p>
              For Demo Mode, add a node entry to{" "}
              <code>src/config/nodes.ts</code> with a unique ID, gateway ID,
              parent ID, firmware, and location. It automatically appears on
              every page after the development server reloads.
            </p>
            <p>
              In Live Mode, provision your ESP32 on the gateway. Nodes returned
              by the gateway’s GET /api/nodes endpoint appear automatically—no
              dashboard changes required.
            </p>
            <a
              href="#settings"
              className="button primary"
              onClick={() => setAdd(false)}
            >
              Node configuration
            </a>
          </div>
        </Modal>
      )}
    </>
  );
}
