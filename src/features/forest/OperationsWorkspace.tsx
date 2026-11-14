"use client";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Camera,
  Radio,
  Thermometer,
  Trees,
  Plus,
  ShieldCheck,
  Activity,
  MapPin,
  Play,
  Download,
} from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import { Panel, Modal, StatusBadge } from "@/components/ui";
import "./operations.css";
type Node = {
  id: string;
  name: string;
  region: string;
  status: string;
  battery?: number;
  capabilities: string[];
  lat?: number;
  lng?: number;
  captured?: string;
};
type Incident = {
  id: string;
  node: string;
  title: string;
  severity: string;
  status: string;
  time: string;
  signals: string[];
  notes: string[];
};
export const fixtures: Node[] = [
  {
    id: "VD-01",
    name: "North ridge",
    region: "Dhauladhar · Sector A",
    status: "online",
    battery: 86,
    capabilities: ["Camera", "Audio", "Thermal", "Sensors"],
    lat: 32.218,
    lng: 76.322,
  },
  {
    id: "VD-02",
    name: "Trail junction",
    region: "Dhauladhar · Sector A",
    status: "online",
    battery: 72,
    capabilities: ["Camera", "Audio"],
    lat: 32.215,
    lng: 76.328,
  },
  {
    id: "VD-03",
    name: "River watch",
    region: "Dhauladhar · Sector B",
    status: "online",
    battery: 23,
    capabilities: ["Sensors"],
    lat: 32.211,
    lng: 76.324,
  },
  {
    id: "VD-04",
    name: "East boundary",
    region: "Dhauladhar · Sector B",
    status: "offline",
    battery: 12,
    capabilities: ["Camera", "Sensors"],
    lat: 32.213,
    lng: 76.333,
  },
];
let demoIncidents: Incident[] = [];
let demoRegistrations: Node[] = [];
const tabs = [
  "Overview",
  "Camera",
  "Audio",
  "Thermal",
  "Sensors",
  "Incidents",
  "Network",
  "Configuration",
];
function exportRows(rows: unknown[], mode: string) {
  const blob = new Blob([JSON.stringify({ mode, records: rows }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vandoot-${mode}-review.json`;
  a.click();
  URL.revokeObjectURL(url);
}
export function OperationsWorkspace({
  page = "overview",
  nodeId,
}: {
  page?: string;
  nodeId?: string;
}) {
  const { settings, data, error } = useDashboard();
  const demo = settings.mode === "demo";
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("all");
  const [status, setStatus] = useState("all");
  const [tab, setTab] = useState("Overview");
  const [incidents, setIncidents] = useState<Incident[]>(() => demoIncidents);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [note, setNote] = useState("");
  const [add, setAdd] = useState(false);
  const [name, setName] = useState("");
  const [caps, setCaps] = useState<string[]>([]);
  const [registered, setRegistered] = useState<Node[]>(() => demoRegistrations);
  const [started] = useState(() => new Date().toISOString());
  useEffect(() => {
    demoIncidents = incidents;
  }, [incidents]);
  useEffect(() => {
    demoRegistrations = registered;
  }, [registered]);
  useEffect(() => {
    setTab("Overview");
    setSelected(null);
  }, [nodeId, demo]);
  const nodes: Node[] = demo
    ? [...fixtures.map((n) => ({ ...n, captured: started })), ...registered]
    : data.nodes.map((n) => ({
        id: n.id,
        name: n.name,
        region: n.location.label || "Unassigned region",
        status:
          Date.now() - Date.parse(n.lastSeen) > 30000 ? "stale" : n.status,
        battery: Number.isFinite(n.readings.battery)
          ? n.readings.battery
          : undefined,
        capabilities: [],
        lat: n.location.lat,
        lng: n.location.lng,
        captured: n.lastSeen,
      }));
  const visible = nodes.filter(
    (n) =>
      (region === "all" || n.region === region) &&
      (status === "all" || n.status === status) &&
      `${n.id} ${n.name}`.toLowerCase().includes(query.toLowerCase()),
  );
  const node = nodes.find((n) => n.id === nodeId);
  const active = demo
    ? incidents.filter((i) => !["Resolved", "False alarm"].includes(i.status))
    : [];
  function replay() {
    const time = new Date().toISOString();
    setIncidents((old) => [
      {
        id: `DEMO-${Date.now()}`,
        node: "VD-01",
        title: "Persistent thermal hotspot",
        severity: "warning",
        status: "New",
        time,
        signals: [
          "Synthetic thermal maximum: 68 °C for 30 s",
          "Synthetic temperature rise: +8 °C over 60 s",
          "Demo rule: review hotspot; fire is not confirmed",
        ],
        notes: [],
      },
      ...old,
    ]);
  }
  function update(value: string) {
    if (!selected) return;
    const next = {
      ...selected,
      status: value,
      notes: [
        ...selected.notes,
        `${new Date().toISOString()} · Demo operator → ${value}`,
      ],
    };
    setIncidents((old) => old.map((i) => (i.id === next.id ? next : i)));
    setSelected(next);
  }
  const incidentList = (items: Incident[]) =>
    items.length ? (
      items.map((i) => (
        <button
          className="ops-incident"
          key={i.id}
          onClick={() => setSelected(i)}
        >
          <span className="ops-alert-icon">
            <Thermometer size={20} />
          </span>
          <span>
            <strong>{i.title}</strong>
            <small>
              {i.node} · {new Date(i.time).toLocaleTimeString()} · {i.status}
            </small>
          </span>
          <StatusBadge status={i.severity} />
          <ArrowUpRight size={17} />
        </button>
      ))
    ) : (
      <div className="ops-empty">
        <ShieldCheck />
        <strong>No incidents to review</strong>
        <p>
          {demo
            ? "Replay a labelled scenario to explore the review workflow."
            : "No incident service is connected to this workspace."}
        </p>
      </div>
    );
  const nodeCards = (list: Node[]) => (
    <div className="ops-node-grid">
      {list.map((n) => (
        <a className="ops-node" href={`#nodes/${n.id}`} key={n.id}>
          <div className="ops-row">
            <span className="ops-id">{n.id}</span>
            <StatusBadge status={n.status} />
          </div>
          <h3>{n.name}</h3>
          <p>
            <MapPin size={12} /> {n.region}
          </p>
          <div className="ops-capabilities">
            {n.capabilities.length ? (
              n.capabilities.map((c) => <span key={c}>{c}</span>)
            ) : (
              <span>Capabilities not reported</span>
            )}
          </div>
          <div className="ops-node-foot">
            <span>
              Battery <b>{n.battery === undefined ? "—" : `${n.battery}%`}</b>
            </span>
            <span>Open workspace ↗</span>
          </div>
        </a>
      ))}
    </div>
  );
  return (
    <div className="ops">
      <div className="ops-context">
        <span>
          <Trees size={16} /> FOREST OPERATIONS{" "}
          <b>
            {demo ? "DEMO · SYNTHETIC SCENARIO" : "LIVE · REPORTED DATA ONLY"}
          </b>
        </span>
        <span>
          Wi-Fi / local gateway ·{" "}
          {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </span>
      </div>
      <div className="ops-toolbar">
        <label>
          Forest region
          <select
            aria-label="Forest region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            <option value="all">All regions</option>
            {Array.from(new Set(nodes.map((n) => n.region))).map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <span className="ops-muted">
          {demo
            ? "Illustrative locations • no physical devices connected"
            : error
              ? "Gateway unavailable"
              : "Gateway data • capabilities require configuration"}
        </span>
        {demo && (
          <button className="button primary" onClick={replay}>
            <Play size={14} /> Replay demo incident
          </button>
        )}
      </div>
      {nodeId ? (
        node ? (
          <>
            <a className="ops-back" href="#nodes">
              ← All nodes
            </a>
            <div className="ops-node-heading">
              <div>
                <span className="ops-id">{node.id}</span>
                <h2>{node.name}</h2>
                <p>
                  {node.region} ·{" "}
                  {node.captured
                    ? `Captured ${new Date(node.captured).toLocaleString()}`
                    : "No telemetry received"}
                </p>
              </div>
              <StatusBadge status={node.status} />
            </div>
            <div className="ops-tabs" role="tablist">
              {tabs.map((t) => (
                <button
                  role="tab"
                  aria-selected={tab === t}
                  key={t}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <Panel title={`${node.name} / ${tab}`}>
              {tab === "Overview" ? (
                <div className="ops-details">
                  <p>
                    Transport{" "}
                    <strong>Wi-Fi / local network {demo && "(demo)"}</strong>
                  </p>
                  <p>
                    Installed capabilities{" "}
                    <strong>
                      {node.capabilities.join(", ") || "Not reported"}
                    </strong>
                  </p>
                  <p>
                    Connection{" "}
                    <strong>
                      {node.status === "registered"
                        ? "Registered only · not configured"
                        : demo
                          ? "Simulated device health"
                          : node.status}
                    </strong>
                  </p>
                  <p>
                    AI inference <strong>Not configured</strong>
                  </p>
                  <p>
                    Coverage{" "}
                    <strong>
                      Not measured; no full-region coverage implied
                    </strong>
                  </p>
                </div>
              ) : tab === "Incidents" ? (
                incidentList(
                  demo ? incidents.filter((i) => i.node === node.id) : [],
                )
              ) : tab === "Network" ? (
                <div className="ops-empty">
                  <Radio />
                  <strong>
                    {demo
                      ? "Demo gateway association"
                      : "Gateway diagnostics not configured"}
                  </strong>
                  <p>
                    Wi-Fi prototype. LoRa mesh, routes, latency and delivery
                    metrics await measured device reports.
                  </p>
                </div>
              ) : tab === "Configuration" ? (
                <div className="ops-empty">
                  <Activity />
                  <strong>
                    {node.status === "registered"
                      ? "Registered · connection not configured"
                      : "Source configuration pending"}
                  </strong>
                  <p>
                    Saving a registration does not test telemetry, media or
                    inference connectivity.
                  </p>
                  <a className="button" href="#integration">
                    Open hardware integration
                  </a>
                </div>
              ) : node.capabilities.includes(tab) ? (
                <div className="ops-empty">
                  {tab === "Camera" ? (
                    <Camera />
                  ) : tab === "Thermal" ? (
                    <Thermometer />
                  ) : (
                    <Activity />
                  )}
                  <strong>
                    {tab === "Sensors"
                      ? "Sensor readings not configured in this scenario"
                      : "Not configured"}
                  </strong>
                  <p>
                    {tab === "Audio"
                      ? "Use an actual microphone recording. Sound intensity alone cannot identify a sound."
                      : tab === "Thermal"
                        ? "Import a recorded 32 × 24 MLX90640 frame. No simulated live temperatures are supplied."
                        : tab === "Camera"
                          ? "No camera source connected. Uploaded images can be analysed by a configured model service."
                          : "This preview does not invent measurements for registered capabilities."}
                  </p>
                  {tab !== "Sensors" && (
                    <a className="button" href={`#${tab.toLowerCase()}`}>
                      Open {tab.toLowerCase()} evidence tools ↗
                    </a>
                  )}
                </div>
              ) : (
                <div className="ops-empty">
                  <Activity />
                  <strong>
                    {demo ? "Not installed" : "Capabilities not reported"}
                  </strong>
                  <p>Configure and verify this source before monitoring it.</p>
                </div>
              )}
            </Panel>
          </>
        ) : (
          <Panel title="Node unavailable">
            <p>This node is not registered in the selected mode.</p>
          </Panel>
        )
      ) : page === "nodes" || page === "live-monitoring" ? (
        <>
          <div className="ops-row">
            <div>
              <h2>
                {page === "nodes" ? "Deployed nodes" : "Monitoring workspaces"}
              </h2>
              <p className="ops-muted">
                Select a node to inspect its sources and supporting evidence.
              </p>
            </div>
            <button
              className="button"
              disabled={!demo}
              title={
                !demo ? "Live provisioning requires the local backend" : ""
              }
              onClick={() => setAdd(true)}
            >
              <Plus size={14} /> Register demo node
            </button>
          </div>
          <div className="ops-filters">
            <input
              aria-label="Search nodes"
              placeholder="Search node ID or name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              aria-label="Connection status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">All connection states</option>
              {["online", "offline", "stale", "registered"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          {nodeCards(visible)}
          {!visible.length && (
            <div className="ops-empty">
              No matching nodes. Configure your gateway or change the filters.
            </div>
          )}
        </>
      ) : page === "incidents" ? (
        <Panel
          title="Incident review"
          subtitle="Observations requiring human review; no automatic inference of intent."
        >
          {incidentList(demo ? incidents : [])}
        </Panel>
      ) : page === "network" ? (
        <Panel title="Local network health">
          <p className="ops-muted">
            {demo
              ? "Simulated status; no measured network metrics."
              : "Only reported nodes are shown. No inferred topology."}
          </p>
          {visible.map((n) => (
            <div className="ops-network-row" key={n.id}>
              <a href={`#nodes/${n.id}`}>
                {n.id} · {n.name}
              </a>
              <span>Wi-Fi {demo ? "scenario" : "prototype"}</span>
              <StatusBadge status={n.status} />
            </div>
          ))}
          <p className="ops-notice">
            LoRa mesh is a future integration. Continuous camera and audio
            transport is not supported over LoRa.
          </p>
        </Panel>
      ) : page === "map" ? (
        <Panel
          title="Forest locations"
          subtitle="Offline coordinate view · no internet tiles required"
        >
          {visible.map((n) => (
            <div className="ops-network-row" key={n.id}>
              <a href={`#nodes/${n.id}`}>
                {n.id} · {n.name}
              </a>
              <span>
                {Number.isFinite(n.lat) && Number.isFinite(n.lng)
                  ? `${n.lat}, ${n.lng}`
                  : "Coordinates missing"}
              </span>
              <StatusBadge status={n.status} />
            </div>
          ))}
          <p className="ops-notice">
            {demo
              ? "All coordinates are illustrative, not deployment locations."
              : "Locations are reported by your gateway."}{" "}
            Sensor coverage is not estimated.
          </p>
        </Panel>
      ) : page === "reports" ? (
        <Panel title="History & reports">
          <p>
            Export the available review records with explicit source mode. No
            unavailable sensor fields are added.
          </p>
          <button
            className="button"
            disabled={!demo || !incidents.length}
            onClick={() => exportRows(incidents, "demo")}
          >
            <Download size={16} /> Export demo review JSON
          </button>
          <a href="#data-logs" className="button">
            Open telemetry history
          </a>
          {incidentList(demo ? incidents : [])}
        </Panel>
      ) : (
        <>
          <div className="ops-intro">
            <div>
              <span className="ops-kicker">REGIONAL COMMAND / VANDOOT</span>
              <h2>A clearer view of your forest.</h2>
              <p>
                Observe the signals. Review the evidence. Coordinate the
                response.
              </p>
            </div>
            <Trees size={60} strokeWidth={1} />
          </div>
          <div className="ops-stats">
            {[
              ["Registered nodes", visible.length],
              ["Online", visible.filter((n) => n.status === "online").length],
              [
                "Offline / stale",
                visible.filter((n) => ["offline", "stale"].includes(n.status))
                  .length,
              ],
              [
                "Active incidents",
                active.filter((i) => visible.some((n) => n.id === i.node))
                  .length,
              ],
              [
                "Critical",
                active.filter(
                  (i) =>
                    i.severity === "critical" &&
                    visible.some((n) => n.id === i.node),
                ).length,
              ],
              [
                "Low battery",
                visible.filter((n) => n.battery !== undefined && n.battery < 25)
                  .length,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{demo ? "Demo scenario" : "Reported data"}</small>
              </div>
            ))}
          </div>
          <div className="ops-columns">
            <Panel
              title="Priority review"
              subtitle="Signals are indicators, not confirmed threats."
              action={<a href="#incidents">View all ↗</a>}
            >
              {incidentList(
                active.filter((i) => visible.some((n) => n.id === i.node)),
              )}
            </Panel>
            <Panel title="Gateway & evidence">
              <div className="ops-details">
                <p>
                  Gateway{" "}
                  <strong>
                    {demo
                      ? "Demo environment"
                      : error
                        ? "Disconnected"
                        : "Telemetry endpoint"}
                  </strong>
                </p>
                <p>
                  Camera / audio / thermal <strong>Not configured</strong>
                </p>
                <p>
                  Inference <strong>Model service not configured</strong>
                </p>
                <p>
                  Review role{" "}
                  <strong>
                    {demo ? "Demo operator" : "Authentication pending"}
                  </strong>
                </p>
              </div>
              <a className="button" href="#integration">
                Configure integrations ↗
              </a>
            </Panel>
          </div>
          <div className="ops-row ops-section">
            <div>
              <h2>Field nodes</h2>
              <p className="ops-muted">
                Source availability and connection health at a glance.
              </p>
            </div>
            <a href="#nodes">All nodes ↗</a>
          </div>
          {nodeCards(visible)}
          <p className="ops-notice">
            {demo
              ? `Synthetic fixture loaded ${new Date(started).toLocaleString()}. Status is simulated, not a device heartbeat.`
              : "Freshness is calculated from reported capture timestamps."}{" "}
            Detection coverage depends on placement, terrain, power and
            connectivity.
          </p>
        </>
      )}
      {selected && demo && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <div className="modal-body ops">
            <span className="ops-kicker">
              SYNTHETIC EVIDENCE / {selected.id}
            </span>
            <p>
              {selected.node} · {selected.time}
            </p>
            <ul>
              {selected.signals.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <label>
              Review status
              <select
                value={selected.status}
                onChange={(e) => update(e.target.value)}
              >
                {[
                  "New",
                  "Acknowledged",
                  "Investigating",
                  "Resolved",
                  "False alarm",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Ranger note
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <button
              className="button"
              disabled={!note.trim()}
              onClick={() => {
                const next = {
                  ...selected,
                  notes: [
                    ...selected.notes,
                    `${new Date().toISOString()} · ${note.trim()}`,
                  ],
                };
                setIncidents((old) =>
                  old.map((i) => (i.id === next.id ? next : i)),
                );
                setSelected(next);
                setNote("");
              }}
            >
              Add note
            </button>
            <h3>Review history</h3>
            {selected.notes.map((n, i) => (
              <p key={i}>{n}</p>
            ))}
            <p className="ops-notice">
              Demo changes are held in this page session only. No live incident
              is created.
            </p>
          </div>
        </Modal>
      )}
      {add && (
        <Modal title="Register a demo node" onClose={() => setAdd(false)}>
          <form
            className="modal-body ops"
            onSubmit={(e) => {
              e.preventDefault();
              setRegistered((old) => [
                ...old,
                {
                  id: `VD-DEMO-${old.length + 5}`,
                  name: name.trim(),
                  region: "Unassigned region",
                  status: "registered",
                  capabilities: caps,
                },
              ]);
              setName("");
              setCaps([]);
              setAdd(false);
            }}
          >
            <label>
              Node name
              <input
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <p>Installed capabilities</p>
            {["Camera", "Audio", "Thermal", "Sensors"].map((c) => (
              <label className="ops-check" key={c}>
                <input
                  type="checkbox"
                  checked={caps.includes(c)}
                  onChange={(e) =>
                    setCaps((old) =>
                      e.target.checked
                        ? [...old, c]
                        : old.filter((x) => x !== c),
                    )
                  }
                />
                {c}
              </label>
            ))}
            <p className="ops-notice">
              Demo registration only. Sources, location, gateway and credentials
              remain unconfigured. Registration does not mark a node online.
            </p>
            <button className="button primary" disabled={!name.trim()}>
              Save demo registration
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
