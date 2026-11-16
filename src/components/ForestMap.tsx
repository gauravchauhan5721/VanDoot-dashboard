"use client";
import { Radio, CircleX } from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import { Panel, EmptyState } from "./ui";
export function ForestMap({
  selected,
  onSelect,
}: {
  selected?: string;
  onSelect: (id: string) => void;
}) {
  const { data, settings } = useDashboard();
  const nodes = data.nodes.filter(
    (n) => Number.isFinite(n.location.lat) && Number.isFinite(n.location.lng),
  );
  const lats = nodes.map((n) => n.location.lat),
    lngs = nodes.map((n) => n.location.lng);
  const minLat = Math.min(...lats),
    maxLat = Math.max(...lats),
    minLng = Math.min(...lngs),
    maxLng = Math.max(...lngs);
  return (
    <Panel
      title="Forest watch map"
      subtitle={
        settings.mode === "demo"
          ? "Illustrative locations · select a node to watch"
          : "Gateway coordinates · select a node to watch"
      }
      action={
        <a href="#map" className="text-link">
          Expand map ↗
        </a>
      }
    >
      <div className="forest-watch-map">
        {!nodes.length ? (
          <EmptyState
            title="No surveyed locations"
            description="Report valid latitude and longitude from the gateway."
          />
        ) : (
          <>
            <svg viewBox="0 0 600 300" aria-hidden="true">
              <defs>
                <pattern
                  id="forest-contour"
                  width="140"
                  height="100"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M-20 60 Q50 -20 140 50 M-20 80 Q50 0 140 70 M-20 100 Q50 20 140 90"
                    fill="none"
                    stroke="var(--map-grid)"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect width="600" height="300" fill="var(--map-bg)" />
              <rect width="600" height="300" fill="url(#forest-contour)" />
              <path
                d="M0 230 Q160 180 260 240 T600 50"
                fill="none"
                stroke="var(--cyan)"
                strokeOpacity=".2"
                strokeWidth="12"
              />
            </svg>
            {nodes.map((n) => (
              <button
                key={n.id}
                aria-label={`Watch ${n.id}`}
                aria-pressed={selected === n.id}
                className={`forest-marker ${selected === n.id ? "selected" : ""} ${n.status === "offline" ? "offline" : ""}`}
                style={{
                  left: `${15 + ((n.location.lng - minLng) / (maxLng - minLng || 1)) * 70}%`,
                  top: `${18 + ((maxLat - n.location.lat) / (maxLat - minLat || 1)) * 56}%`,
                }}
                onClick={() => onSelect(n.id)}
              >
                <span>{n.status === "offline" ? "×" : "◉"}</span>
                <strong>{n.id}</strong>
              </button>
            ))}
            <span className="map-north">N ↑</span>
          </>
        )}
      </div>
      <div className="map-key">
        <span>
          <i className="status-dot" />
          Selected node
        </span>
        <span>WGS84 · offline coordinate map</span>
      </div>
    </Panel>
  );
}
