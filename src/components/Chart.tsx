"use client";
import { useId, useState } from "react";
import { HistoryPoint } from "@/types";
import { EmptyState } from "./ui";
interface Series {
  id: string;
  name: string;
  color: string;
}
export function Chart({
  data,
  sensor = "temperature",
  series,
  height = 210,
  unit = "°C",
}: {
  data: HistoryPoint[];
  sensor?: string;
  series: Series[];
  height?: number;
  unit?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const visible = series.filter((s) => !hidden.includes(s.id));
  const grouped = visible.map((s) => ({
    ...s,
    points: data.filter(
      (p) => p.nodeId === s.id && Number.isFinite(p.readings[sensor]),
    ),
  }));
  const all = grouped.flatMap((s) => s.points.map((p) => p.readings[sensor]));
  if (!all.length && !hidden.length)
    return (
      <EmptyState
        title="No readings in this period"
        description="Choose another sensor or wait for the next telemetry update."
      />
    );
  const low = Math.floor(Math.min(...(all.length ? all : [0])) - 2),
    high = Math.ceil(Math.max(...(all.length ? all : [1])) + 2);
  const w = 700,
    h = height,
    left = 42,
    right = 14,
    top = 18,
    bottom = 30;
  const plotH = h - top - bottom,
    plotW = w - left - right;
  const sample = (points: HistoryPoint[]) => {
    if (points.length <= 70) return points;
    return Array.from(
      { length: 70 },
      (_, i) => points[Math.round((i * (points.length - 1)) / 69)],
    );
  };
  const lines = grouped.map((s) => ({ ...s, points: sample(s.points) }));
  const dates = lines.find((s) => s.points.length)?.points || [];
  const hoverPoint =
    hover !== null && dates.length
      ? Math.round(hover * (dates.length - 1))
      : null;
  return (
    <div className="chart-wrap">
      <div
        className="chart-plot"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          setHover(
            Math.max(
              0,
              Math.min(
                1,
                (((e.clientX - box.left) / box.width) * w - left) / plotW,
              ),
            ),
          );
        }}
      >
        <svg
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-label={`${sensor} history chart`}
          preserveAspectRatio="none"
        >
          <defs>
            {lines.map((s) => (
              <linearGradient
                key={s.id}
                id={`${uid}-${s.id}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity=".12" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {Array.from({ length: 5 }, (_, i) => {
            const y = top + (i * plotH) / 4;
            return (
              <g key={i}>
                <line
                  x1={left}
                  x2={w - right}
                  y1={y}
                  y2={y}
                  stroke="var(--border)"
                  strokeDasharray="3 5"
                />
                <text
                  x={left - 11}
                  y={y + 4}
                  textAnchor="end"
                  fill="var(--muted)"
                  fontSize="10"
                >
                  {(high - (i * (high - low)) / 4).toFixed(0)}
                  {unit === "°C" || unit === "°F" ? "°" : ""}
                </text>
              </g>
            );
          })}
          {lines.map((s) => {
            const points = s.points.map(
              (p, i) =>
                `${left + (i / Math.max(1, s.points.length - 1)) * plotW},${top + ((high - p.readings[sensor]) / (high - low)) * plotH}`,
            );
            return (
              <g key={s.id}>
                {points.length > 1 && (
                  <polygon
                    points={`${left},${h - bottom} ${points.join(" ")} ${w - right},${h - bottom}`}
                    fill={`url(#${uid}-${s.id})`}
                  />
                )}
                <polyline
                  points={points.join(" ")}
                  stroke={s.color}
                  fill="none"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </g>
            );
          })}
          {Array.from({ length: 7 }, (_, i) => {
            const p =
              dates[Math.round((i / 6) * Math.max(0, dates.length - 1))];
            return (
              <text
                key={i}
                x={left + (i * plotW) / 6}
                y={h - 7}
                textAnchor="middle"
                fill="var(--muted)"
                fontSize="10"
              >
                {p
                  ? new Date(p.timestamp).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })
                  : ""}
              </text>
            );
          })}
          {hover !== null && (
            <line
              x1={left + hover * plotW}
              x2={left + hover * plotW}
              y1={top}
              y2={h - bottom}
              stroke="var(--muted)"
              strokeDasharray="4 4"
            />
          )}
        </svg>
        {hoverPoint !== null && dates[hoverPoint] && (
          <div
            className="chart-tooltip"
            style={{ left: `${Math.min(70, Math.max(6, (hover || 0) * 85))}%` }}
          >
            <small>
              {new Date(dates[hoverPoint].timestamp).toLocaleString()}
            </small>
            {lines.map((s) => {
              const p =
                s.points[Math.round((hover || 0) * (s.points.length - 1))];
              return (
                p && (
                  <div key={s.id}>
                    <i style={{ background: s.color }} />
                    {s.name}
                    <b>
                      {p.readings[sensor].toFixed(1)} {unit}
                    </b>
                  </div>
                )
              );
            })}
          </div>
        )}
      </div>
      <div className="chart-legend">
        {series.map((s) => (
          <button
            key={s.id}
            style={{ opacity: hidden.includes(s.id) ? 0.35 : 1 }}
            onClick={() =>
              setHidden((current) =>
                current.includes(s.id)
                  ? current.filter((id) => id !== s.id)
                  : [...current, s.id],
              )
            }
          >
            <i style={{ background: s.color }} />
            {s.name}
          </button>
        ))}
        <span>{unit}</span>
      </div>
    </div>
  );
}
