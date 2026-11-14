"use client";
import { useMemo, useState } from "react";
import { Maximize, Minus, Plus, Radio, RotateCcw } from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import { EmptyState, Modal, StatusBadge } from "./ui";
export function NetworkTopology({ large = false }: { large?: boolean }) {
  const { data } = useDashboard();
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const layout = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    const depth = (id: string, seen: Set<string> = new Set()): number => {
      if (seen.has(id)) return 1;
      seen.add(id);
      const node = data.nodes.find((n) => n.id === id);
      return node ? 1 + depth(node.parentId, seen) : 0;
    };
    const levels: Record<number, string[]> = {};
    [...data.gateways, ...data.nodes].forEach((item) => {
      const d = depth(item.id);
      (levels[d] ||= []).push(item.id);
    });
    const maxDepth = Math.max(1, ...Object.keys(levels).map(Number));
    Object.entries(levels).forEach(([d, ids]) =>
      ids.forEach(
        (id, i) =>
          (positions[id] = {
            x: ((i + 1) * 680) / (ids.length + 1),
            y: 70 + (Number(d) * 190) / maxDepth,
          }),
      ),
    );
    return positions;
  }, [data.nodes, data.gateways]);
  if (!data.gateways.length && !data.nodes.length) return <EmptyState />;
  const node = data.nodes.find((n) => n.id === selected);
  const gateway = data.gateways.find((g) => g.id === selected);
  const content = (
    <div className={`topology ${large || expanded ? "large" : ""}`}>
      <div className="topology-corner">
        <span className="status-dot" />
        Live topology <span className="dim">· LoRa 868 MHz</span>
      </div>
      <svg
        viewBox="0 0 680 350"
        role="img"
        aria-label="Interactive LoRaMesh network topology"
      >
        <g
          transform={`translate(${340 * (1 - zoom)},${175 * (1 - zoom)}) scale(${zoom})`}
        >
          {data.links.map((link) => {
            const a = layout[link.source],
              b = layout[link.target];
            if (!a || !b) return null;
            const color =
              link.status === "offline"
                ? "#ee7777"
                : link.status === "weak"
                  ? "#e6b85f"
                  : "#96c95c";
            return (
              <g key={link.id}>
                <path
                  d={`M${a.x},${a.y + 26} C${a.x},${a.y + 88} ${b.x},${b.y - 88} ${b.x},${b.y - 25}`}
                  fill="none"
                  stroke={color}
                  strokeOpacity=".55"
                  strokeWidth="1.6"
                  strokeDasharray="5 6"
                  className={link.status !== "offline" ? "flow-link" : ""}
                />
                <rect
                  x={(a.x + b.x) / 2 - 37}
                  y={(a.y + b.y) / 2 + (a.x === b.x ? 14 : -8)}
                  width="74"
                  height="21"
                  rx="5"
                  fill="var(--panel)"
                  stroke="var(--border)"
                />
                <text
                  x={(a.x + b.x) / 2}
                  y={(a.y + b.y) / 2 + (a.x === b.x ? 28 : 6)}
                  textAnchor="middle"
                  fontSize="10"
                  fill={color}
                >
                  {link.rssi.toFixed(0)} dBm
                </text>
              </g>
            );
          })}
          {data.gateways.map((g) => {
            const p = layout[g.id];
            return (
              <g
                key={g.id}
                className="topology-device"
                tabIndex={0}
                role="button"
                aria-label={`Inspect ${g.id}`}
                onClick={() => setSelected(g.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setSelected(g.id);
                }}
              >
                <rect
                  x={p.x - 32}
                  y={p.y - 30}
                  width="64"
                  height="60"
                  rx="15"
                  fill="var(--green-dim)"
                  stroke="#809c54"
                  strokeOpacity=".6"
                />
                <rect
                  x={p.x - 15}
                  y={p.y - 16}
                  width="30"
                  height="26"
                  rx="5"
                  fill="none"
                  stroke="#b6de85"
                  strokeWidth="1.6"
                />
                <path
                  d={`M${p.x - 10},${p.y - 7} h20 M${p.x - 10},${p.y + 1} h20 M${p.x - 7},${p.y + 16} h14 M${p.x},${p.y + 10} v6`}
                  stroke="#b6de85"
                  strokeWidth="1.6"
                />
                <circle
                  cx={p.x + 27}
                  cy={p.y - 25}
                  r="5"
                  fill={g.status === "online" ? "#b8e66c" : "#e6b85f"}
                  stroke="var(--panel)"
                  strokeWidth="3"
                />
                <text
                  x={p.x}
                  y={p.y - 44}
                  textAnchor="middle"
                  fill="var(--text)"
                  fontSize="12"
                  fontWeight="600"
                >
                  Raspberry Pi Gateway
                </text>
                <text
                  x={p.x}
                  y={p.y + 49}
                  textAnchor="middle"
                  fill="var(--muted)"
                  fontSize="10"
                >
                  {g.id} · {g.ip}
                </text>
              </g>
            );
          })}
          {data.nodes.map((n) => {
            const p = layout[n.id];
            const color =
              n.status === "offline"
                ? "#ee7777"
                : n.status === "weak"
                  ? "#e6b85f"
                  : "#b8e66c";
            return (
              <g
                className="topology-device"
                key={n.id}
                tabIndex={0}
                role="button"
                aria-label={`Inspect ${n.id}`}
                onClick={() => setSelected(n.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setSelected(n.id);
                }}
              >
                <rect
                  x={p.x - 28}
                  y={p.y - 27}
                  width="56"
                  height="54"
                  rx="13"
                  fill="var(--panel-raised)"
                  stroke={color}
                  strokeOpacity=".4"
                />
                <rect
                  x={p.x - 10}
                  y={p.y - 11}
                  width="20"
                  height="22"
                  rx="3"
                  fill="none"
                  stroke={color}
                  strokeWidth="1.5"
                />
                {[-6, 0, 6].map((k) => (
                  <path
                    key={k}
                    d={`M${p.x - 15},${p.y + k} h5 M${p.x + 10},${p.y + k} h5 M${p.x + k},${p.y - 16} v5 M${p.x + k},${p.y + 11} v5`}
                    stroke={color}
                    strokeWidth="1.3"
                  />
                ))}
                <circle
                  cx={p.x + 24}
                  cy={p.y - 22}
                  r="4.5"
                  fill={color}
                  stroke="var(--panel)"
                  strokeWidth="2.5"
                />
                <text
                  x={p.x}
                  y={p.y + 46}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="var(--text)"
                >
                  {n.id}
                </text>
                <text
                  x={p.x}
                  y={p.y + 63}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--muted)"
                >
                  ESP32 · {n.readings.battery.toFixed(0)}% battery
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="topology-controls">
        <button
          aria-label="Zoom in"
          onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
        >
          <Plus size={14} />
        </button>
        <button
          aria-label="Zoom out"
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
        >
          <Minus size={14} />
        </button>
        <button aria-label="Reset topology zoom" onClick={() => setZoom(1)}>
          <RotateCcw size={13} />
        </button>
        <button aria-label="Expand topology" onClick={() => setExpanded(true)}>
          <Maximize size={13} />
        </button>
      </div>
      <div className="topology-legend">
        <span>
          <i className="green-dot" />
          Healthy
        </span>
        <span>
          <i className="amber-dot" />
          Weak link
        </span>
        <span>
          <i className="red-dot" />
          Disconnected
        </span>
        <span className="topology-protocol">
          <Radio size={12} /> LoRaMesh
        </span>
      </div>
    </div>
  );
  return (
    <>
      {content}
      {expanded && (
        <Modal title="LoRaMesh network" onClose={() => setExpanded(false)}>
          {content}
        </Modal>
      )}
      {selected && (
        <Modal
          title={node?.id || gateway?.id || "Device"}
          onClose={() => setSelected(null)}
        >
          <div className="modal-body">
            <StatusBadge
              status={node?.status || gateway?.status || "offline"}
            />
            <h3>{node?.name || gateway?.name}</h3>
            <p>{node?.location.label || gateway?.location.label}</p>
            {node && (
              <p>
                RSSI {node.readings.rssi} dBm · SNR {node.readings.snr} dB ·
                Link quality {node.linkQuality}%<br />
                Parent / next hop: {node.parentId}
                <br />
                {node.packets.toLocaleString()} packets transmitted
              </p>
            )}
            <a
              className="button primary"
              href={node ? `#nodes/${node.id}` : "#gateway"}
              onClick={() => {
                setSelected(null);
                setExpanded(false);
              }}
            >
              View device details
            </a>
          </div>
        </Modal>
      )}
    </>
  );
}
