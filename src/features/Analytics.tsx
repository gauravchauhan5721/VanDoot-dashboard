"use client";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ChartNoAxesCombined,
  Download,
  Gauge,
} from "lucide-react";
import { sensors } from "@/config/sensors";
import { useDashboard } from "@/hooks/useDashboard";
import { Chart } from "@/components/Chart";
import { KpiCard, Panel } from "@/components/ui";
import { download } from "@/utils/format";
export function Analytics({
  sensorId,
  nodeId,
}: {
  sensorId?: string;
  nodeId?: string;
}) {
  const { data, settings, notify } = useDashboard();
  const [selectedNode, setNode] = useState(nodeId || "all");
  const [selectedSensor, setSensor] = useState(sensorId || "temperature");
  const [range, setRange] = useState(24);
  const sensor = sensors.find((s) => s.id === selectedSensor) || sensors[0];
  const unit =
    sensor.id === "temperature" && settings.units === "imperial"
      ? "°F"
      : sensor.unit;
  const nodes = data.nodes.filter(
    (n) => selectedNode === "all" || n.id === selectedNode,
  );
  const history = data.history
    .filter(
      (p) =>
        nodes.some((n) => n.id === p.nodeId) &&
        new Date(p.timestamp).getTime() >= Date.now() - range * 3600000,
    )
    .map((p) =>
      sensor.id === "temperature" && settings.units === "imperial"
        ? {
            ...p,
            readings: {
              ...p.readings,
              temperature: (p.readings.temperature * 9) / 5 + 32,
            },
          }
        : p,
    )
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const values = history
    .map((p) => p.readings[sensor.id])
    .filter(Number.isFinite);
  const currentValues = nodes
    .map((n) => n.readings[sensor.id])
    .filter(Number.isFinite)
    .map((v) =>
      sensor.id === "temperature" && settings.units === "imperial"
        ? (v * 9) / 5 + 32
        : v,
    );
  const current = currentValues.length
    ? currentValues.reduce((a, b) => a + b, 0) / currentValues.length
    : 0;
  const average = values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : 0;
  const trend = values.length ? current - values[0] : 0;
  return (
    <>
      <Panel>
        <div className="filter-bar">
          <label className="filter-label">
            Node
            <select
              value={selectedNode}
              onChange={(e) => setNode(e.target.value)}
            >
              <option value="all">All nodes</option>
              {data.nodes.map((n) => (
                <option key={n.id}>{n.id}</option>
              ))}
            </select>
          </label>
          <label className="filter-label">
            Sensor
            <select
              value={sensor.id}
              onChange={(e) => setSensor(e.target.value)}
            >
              {sensors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="range-toggle push">
            {[
              [1, "1 hour"],
              [6, "6 hours"],
              [24, "24 hours"],
              [168, "7 days"],
              [720, "30 days"],
            ].map(([v, name]) => (
              <button
                key={v}
                className={range === v ? "active" : ""}
                onClick={() => setRange(Number(v))}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </Panel>
      <div className="kpi-grid section-gap">
        <KpiCard
          label="Current reading"
          value={values.length ? current.toFixed(sensor.precision) : "—"}
          suffix={unit}
          icon={<Gauge size={18} />}
          foot="Average across selected nodes"
        />
        <KpiCard
          label="Average"
          value={values.length ? average.toFixed(sensor.precision) : "—"}
          suffix={unit}
          icon={<ChartNoAxesCombined size={18} />}
          foot={`${values.length.toLocaleString()} historical samples`}
        />
        <KpiCard
          label="Minimum"
          value={
            values.length ? Math.min(...values).toFixed(sensor.precision) : "—"
          }
          suffix={unit}
          icon={<ArrowDown size={18} />}
          foot="Lowest recorded reading"
        />
        <KpiCard
          label="Maximum"
          value={
            values.length ? Math.max(...values).toFixed(sensor.precision) : "—"
          }
          suffix={unit}
          icon={<ArrowUp size={18} />}
          foot="Highest recorded reading"
        />
      </div>
      <Panel
        title={`${sensor.name} analysis`}
        subtitle={`${range < 24 ? `${range} hour` : `${range / 24} day`} window · ${settings.mode === "demo" ? "Simulated historical data" : "Gateway historical data"}`}
        action={
          <button
            className="button"
            onClick={() => {
              if (!history.length) {
                notify("No history available to export");
                return;
              }
              download(
                `vandoot-${sensor.id}-history.csv`,
                history.map((p) => ({
                  timestamp: p.timestamp,
                  node: p.nodeId,
                  sensor: sensor.name,
                  value: p.readings[sensor.id],
                  unit,
                  mode: settings.mode,
                })),
              );
            }}
          >
            <Download size={14} />
            Export series
          </button>
        }
      >
        <Chart
          key={`${sensor.id}-${selectedNode}-${range}`}
          data={history}
          sensor={sensor.id}
          series={nodes.map((n, i) => ({
            id: n.id,
            name: n.id,
            color: ["#b8e66c", "#63c9e7", "#a59bea", "#f2bd70"][i % 4],
          }))}
          height={320}
          unit={unit}
        />
        <div className="analysis-summary">
          <ArrowUpRight size={18} />
          <span>
            <strong>
              {trend >= 0 ? "+" : ""}
              {trend.toFixed(sensor.precision)} {unit}
            </strong>{" "}
            change from the beginning of this period
          </span>
          <span className="push muted">
            Hover to inspect · Click legend to toggle a series
          </span>
        </div>
      </Panel>
      <Panel title="Per-node statistics" className="section-gap">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Node</th>
                <th>Samples</th>
                <th>Average</th>
                <th>Minimum</th>
                <th>Maximum</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((n) => {
                const v = history
                  .filter((p) => p.nodeId === n.id)
                  .map((p) => p.readings[sensor.id])
                  .filter(Number.isFinite);
                return (
                  <tr key={n.id}>
                    <td>
                      <a href={`#nodes/${n.id}`}>{n.id}</a>
                    </td>
                    <td>{v.length}</td>
                    <td>
                      {v.length
                        ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(
                            sensor.precision,
                          )
                        : "—"}{" "}
                      {unit}
                    </td>
                    <td>
                      {v.length
                        ? Math.min(...v).toFixed(sensor.precision)
                        : "—"}{" "}
                      {unit}
                    </td>
                    <td>
                      {v.length
                        ? Math.max(...v).toFixed(sensor.precision)
                        : "—"}{" "}
                      {unit}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
