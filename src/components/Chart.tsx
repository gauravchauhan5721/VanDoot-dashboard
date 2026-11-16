"use client";
import { useEffect, useId, useRef, useState } from "react";
import { HistoryPoint } from "@/types";
import { captureTime } from "@/utils/telemetry";
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
  const uid = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(700);
  useEffect(() => {
    if (!plotRef.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setChartWidth(Math.max(260, Math.round(entry.contentRect.width))),
    );
    observer.observe(plotRef.current);
    return () => observer.disconnect();
  }, []);
  const [index, setIndex] = useState(0);
  const [hidden, setHidden] = useState<string[]>([]);
  const times = [
    ...new Set(
      data.map((p) => Date.parse(p.timestamp)).filter(Number.isFinite),
    ),
  ].sort((a, b) => a - b);
  const selected = Math.min(index, Math.max(0, times.length - 1));
  const time = times[selected];
  const visible = series.filter((s) => !hidden.includes(s.id));
  const values = data
    .filter((p) => visible.some((s) => s.id === p.nodeId))
    .map((p) => p.readings[sensor])
    .filter(Number.isFinite);
  const low = Math.floor(Math.min(...(values.length ? values : [0])) - 2),
    high = Math.ceil(Math.max(...(values.length ? values : [1])) + 2);
  const left = 48,
    width = chartWidth,
    plot = chartWidth - 66,
    top = 20,
    bottom = height - 32;
  const start = times[0] || 0,
    end = times.at(-1) || start + 1;
  const x = (t: number) => left + ((t - start) / (end - start || 1)) * plot;
  const y = (v: number) => top + ((high - v) / (high - low)) * (bottom - top);
  const lines = visible.map((s) => {
    const points = data
      .filter(
        (p) => p.nodeId === s.id && Number.isFinite(Date.parse(p.timestamp)),
      )
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const intervals = points
      .slice(1)
      .map((p, i) => Date.parse(p.timestamp) - Date.parse(points[i].timestamp))
      .filter((v) => v > 0)
      .sort((a, b) => a - b);
    const gap = Math.max(
      30_000,
      (intervals[Math.floor(intervals.length / 2)] || 30_000) * 2.5,
    );
    let previous = NaN,
      drawing = false,
      path = "";
    for (const p of points) {
      const t = Date.parse(p.timestamp),
        value = p.readings[sensor];
      if (!Number.isFinite(value)) {
        drawing = false;
        previous = t;
        continue;
      }
      path += `${drawing && t - previous <= gap ? "L" : "M"}${x(t).toFixed(2)},${y(value).toFixed(2)} `;
      drawing = true;
      previous = t;
    }
    return { ...s, path, points };
  });
  return (
    <div className="chart-wrap" style={{ minHeight: height + 112 }}>
      <div
        className="chart-plot"
        ref={plotRef}
        onPointerDown={(e) => {
          if (!times.length) return;
          const r = e.currentTarget.getBoundingClientRect();
          const t =
            start +
            Math.max(
              0,
              Math.min(
                1,
                (((e.clientX - r.left) / r.width) * width - left) / plot,
              ),
            ) *
              (end - start);
          let nearest = 0;
          times.forEach((v, i) => {
            if (Math.abs(v - t) < Math.abs(times[nearest] - t)) nearest = i;
          });
          setIndex(nearest);
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${sensor} history chart`}
          preserveAspectRatio="none"
        >
          <title>
            {sensor} in {unit}; missing samples are gaps
          </title>
          {Array.from({ length: 5 }, (_, i) => {
            const value = high - (i * (high - low)) / 4;
            return (
              <g key={i}>
                <line
                  x1={left}
                  x2={width - 18}
                  y1={y(value)}
                  y2={y(value)}
                  stroke="var(--border)"
                  strokeDasharray="3 5"
                />
                <text
                  x={left - 8}
                  y={y(value) + 4}
                  textAnchor="end"
                  fill="var(--muted)"
                  fontSize={11}
                >
                  {value.toFixed(0)}
                </text>
              </g>
            );
          })}
          {lines.map((s) => (
            <path
              key={s.id}
              d={s.path}
              stroke={s.color}
              strokeWidth={2.5}
              fill="none"
            />
          ))}
          {times.length > 0 && (
            <line
              x1={x(time)}
              x2={x(time)}
              y1={top}
              y2={bottom}
              stroke="var(--muted)"
              strokeDasharray="3 5"
            />
          )}
          {[0, 0.5, 1].map((f) => (
            <text
              key={f}
              x={left + f * plot}
              y={height - 8}
              textAnchor="middle"
              fill="var(--muted)"
              fontSize={11}
            >
              {times.length
                ? new Date(start + f * (end - start)).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </text>
          ))}
        </svg>
      </div>
      <div className="chart-legend">
        {series.map((s) => (
          <button
            key={s.id}
            aria-pressed={!hidden.includes(s.id)}
            onClick={() =>
              setHidden((h) =>
                h.includes(s.id) ? h.filter((id) => id !== s.id) : [...h, s.id],
              )
            }
          >
            <i style={{ background: s.color }} />
            {s.name}
          </button>
        ))}
        <span>{unit} · gaps = missing samples</span>
      </div>
      <label className="chart-scrubber" htmlFor={uid}>
        Inspect reading
        <input
          id={uid}
          aria-label={`${sensor} sample`}
          type="range"
          min={0}
          max={Math.max(0, times.length - 1)}
          value={selected}
          disabled={!times.length}
          aria-valuetext={
            times.length
              ? captureTime(new Date(time).toISOString())
              : "No readings"
          }
          onChange={(e) => setIndex(Number(e.target.value))}
        />
      </label>
      <div className="chart-readout" aria-live="polite">
        <time>
          {times.length
            ? captureTime(new Date(time).toISOString())
            : "No readings in this period"}
        </time>
        {lines.map((s) => {
          const p = s.points.find((p) => Date.parse(p.timestamp) === time);
          const value = p?.readings[sensor];
          return (
            <span key={s.id}>
              {s.name}:{" "}
              <strong>
                {typeof value === "number" && Number.isFinite(value)
                  ? value.toFixed(1)
                  : "—"}{" "}
                {unit}
              </strong>
            </span>
          );
        })}
      </div>
    </div>
  );
}
