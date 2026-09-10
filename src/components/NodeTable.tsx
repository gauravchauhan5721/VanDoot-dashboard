"use client";
import { Battery, ChevronRight, Cpu, Signal } from "lucide-react";
import { SensorNode } from "@/types";
import { StatusBadge, EmptyState } from "./ui";
import { ago, number } from "@/utils/format";
import { useDashboard } from "@/hooks/useDashboard";
export function NodeTable({
  nodes,
  detailed = false,
}: {
  nodes: SensorNode[];
  detailed?: boolean;
}) {
  const { settings } = useDashboard();
  if (!nodes.length) return <EmptyState title="No nodes found" />;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Node</th>
            <th>Status</th>
            <th>Temperature</th>
            <th>Humidity</th>
            <th>Battery</th>
            <th>Signal strength</th>
            {detailed && (
              <>
                <th>SNR</th>
                <th>Packets</th>
                <th>Link quality</th>
              </>
            )}
            <th>Last seen</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => (
            <tr key={node.id}>
              <td>
                <a className="device-cell" href={`#nodes/${node.id}`}>
                  <span className="device-icon">
                    <Cpu size={18} />
                  </span>
                  <span>
                    <strong>{node.id}</strong>
                    <small>{detailed ? node.location.label : node.name}</small>
                  </span>
                </a>
              </td>
              <td>
                <StatusBadge
                  status={node.status}
                  label={node.status === "weak" ? "Weak link" : undefined}
                />
              </td>
              <td>
                {(settings.units === "imperial"
                  ? (node.readings.temperature * 9) / 5 + 32
                  : node.readings.temperature
                ).toFixed(1)}
                <span className="unit">
                  {" "}
                  {settings.units === "imperial" ? "°F" : "°C"}
                </span>
              </td>
              <td>
                {node.readings.humidity.toFixed(1)}
                <span className="unit"> %</span>
              </td>
              <td>
                <span
                  className={`inline-metric ${node.readings.battery < 25 ? "amber" : ""}`}
                >
                  <Battery size={16} />
                  {node.readings.battery.toFixed(0)}%
                </span>
              </td>
              <td>
                <span
                  className={`inline-metric ${node.readings.rssi < -90 ? "amber" : "green"}`}
                >
                  <Signal size={15} />
                  <span className="normal-text">
                    {node.readings.rssi.toFixed(0)}{" "}
                    <span className="unit">dBm</span>
                  </span>
                </span>
              </td>
              {detailed && (
                <>
                  <td>{node.readings.snr} dB</td>
                  <td>{number(node.packets)}</td>
                  <td>{node.linkQuality}%</td>
                </>
              )}
              <td className="muted">{ago(node.lastSeen)}</td>
              <td>
                <a
                  className="icon-button"
                  aria-label={`View ${node.id}`}
                  href={`#nodes/${node.id}`}
                >
                  <ChevronRight size={16} />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
