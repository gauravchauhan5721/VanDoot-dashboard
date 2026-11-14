"use client";
import { useState } from "react";
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
} from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import { EmptyState, Panel, StatusBadge } from "@/components/ui";
import { sensors } from "@/config/sensors";
import { download } from "@/utils/format";
export function DataLogs() {
  const { data, settings, notify } = useDashboard();
  const [search, setSearch] = useState("");
  const [node, setNode] = useState("all");
  const [sensor, setSensor] = useState("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{
    key: "timestamp" | "value" | "nodeId";
    asc: boolean;
  }>({ key: "timestamp", asc: false });
  const rows = data.logs
    .filter(
      (l) =>
        `${l.id} ${l.nodeId} ${l.sensor} ${l.event}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (node === "all" || l.nodeId === node) &&
        (sensor === "all" || l.sensor === sensor),
    )
    .sort((a, b) => {
      const result =
        sort.key === "value"
          ? a.value - b.value
          : String(a[sort.key]).localeCompare(String(b[sort.key]));
      return sort.asc ? result : -result;
    });
  const count = Math.max(1, Math.ceil(rows.length / 15));
  const actualPage = Math.min(page, count);
  const sortBy = (key: typeof sort.key) =>
    setSort({ key, asc: sort.key === key ? !sort.asc : true });
  return (
    <Panel
      title="Telemetry log"
      subtitle={`${rows.length.toLocaleString()} records · Last 2,000 readings retained in the browser`}
      action={
        <span className="live-label">
          <i />
          Streaming
        </span>
      }
    >
      <div className="filter-bar">
        <label className="search-field">
          <Search size={16} />
          <input
            placeholder="Search packets, nodes, events…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          aria-label="Log node"
          value={node}
          onChange={(e) => {
            setNode(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All nodes</option>
          {data.nodes.map((n) => (
            <option key={n.id}>{n.id}</option>
          ))}
        </select>
        <select
          aria-label="Log sensor"
          value={sensor}
          onChange={(e) => {
            setSensor(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All sensors</option>
          {sensors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          className="button push"
          onClick={() => {
            if (!rows.length) {
              notify("No matching logs to export");
              return;
            }
            download(
              `vandoot-logs-${settings.mode}.csv`,
              rows.map((r) => ({ ...r, mode: settings.mode })),
            );
          }}
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>
      <div className="table-scroll">
        <table className="log-table">
          <thead>
            <tr>
              <th>
                <button onClick={() => sortBy("timestamp")}>
                  Timestamp
                  <ArrowDownUp size={12} />
                </button>
              </th>
              <th>
                <button onClick={() => sortBy("nodeId")}>
                  Node
                  <ArrowDownUp size={12} />
                </button>
              </th>
              <th>Sensor</th>
              <th>
                <button onClick={() => sortBy("value")}>
                  Value
                  <ArrowDownUp size={12} />
                </button>
              </th>
              <th>Unit</th>
              <th>RSSI</th>
              <th>SNR</th>
              <th>Packet ID</th>
              <th>Status</th>
              <th>Event</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice((actualPage - 1) * 15, actualPage * 15).map((l) => (
              <tr key={l.id}>
                <td>{new Date(l.timestamp).toLocaleTimeString()}</td>
                <td>
                  <a href={`#nodes/${l.nodeId}`}>{l.nodeId}</a>
                </td>
                <td>
                  {sensors.find((s) => s.id === l.sensor)?.name || l.sensor}
                </td>
                <td>{l.value}</td>
                <td className="muted">{l.unit}</td>
                <td>{l.rssi} dBm</td>
                <td>{l.snr} dB</td>
                <td className="packet-id">{l.id}</td>
                <td>
                  <StatusBadge status={l.status} />
                </td>
                <td className="muted">{l.event}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <EmptyState
            title="No matching telemetry"
            description="Try another search or wait for a new reading."
          />
        )}
      </div>
      <div className="pagination">
        <span>
          Showing {rows.length ? (actualPage - 1) * 15 + 1 : 0}–
          {Math.min(actualPage * 15, rows.length)} of {rows.length} records
        </span>
        <div>
          <button
            className="icon-button"
            disabled={actualPage <= 1}
            aria-label="Previous page"
            onClick={() => setPage(actualPage - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            Page {actualPage} of {count}
          </span>
          <button
            className="icon-button"
            disabled={actualPage >= count}
            aria-label="Next page"
            onClick={() => setPage(actualPage + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </Panel>
  );
}
