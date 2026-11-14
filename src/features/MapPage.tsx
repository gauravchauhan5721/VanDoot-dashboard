"use client";
import { useState } from "react";
import { Layers, MapPin, Minus, Plus, RotateCcw } from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import { DetailGrid, Panel, StatusBadge } from "@/components/ui";
export function MapPage() {
  const { data, settings } = useDashboard();
  const [selected, setSelected] = useState("");
  const [zoom, setZoom] = useState(1);
  const [coverage, setCoverage] = useState(true);
  const devices = [...data.gateways, ...data.nodes];
  const center = data.gateways[0]?.location || { lat: 12.9716, lng: 77.5946 };
  const project = (lat: number, lng: number) => ({
    x: 480 + (lng - center.lng) * 110000 * zoom,
    y: 270 - (lat - center.lat) * 110000 * zoom,
  });
  const device = devices.find((d) => d.id === selected);
  return (
    <>
      <div className="info-banner">
        <MapPin size={18} />
        {settings.mode === "demo"
          ? "DEMO LOCATIONS · Simulated facility in Bengaluru, India."
          : "Device coordinates from your gateway."}{" "}
        This is an offline coordinate map; coverage rings are illustrative, not
        a radio survey.
      </div>
      <div className="map-layout">
        <Panel className="map-panel">
          <div className="site-map">
            <svg
              viewBox="0 0 960 570"
              role="img"
              aria-label="Node location map"
            >
              <defs>
                <pattern
                  id="map-grid"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M40 0H0V40"
                    fill="none"
                    stroke="var(--map-grid)"
                    strokeWidth=".6"
                  />
                </pattern>
              </defs>
              <rect width="960" height="570" fill="var(--map-bg)" />
              <rect width="960" height="570" fill="url(#map-grid)" />
              <g stroke="var(--map-road)" strokeWidth="17" fill="none">
                <path d="M-20 160L270 160L420 55L950 55M100 590V320L270 160V0M-20 440L440 440L670 300L1000 300M760 -20V600" />
              </g>
              <g fill="var(--map-building)" stroke="var(--map-grid)">
                <rect x="305" y="184" width="118" height="84" rx="5" />
                <rect x="488" y="335" width="116" height="70" rx="5" />
                <rect x="802" y="108" width="90" height="129" rx="5" />
                <rect x="126" y="323" width="122" height="80" rx="5" />
                <rect x="471" y="100" width="168" height="63" rx="5" />
                <rect x="782" y="365" width="142" height="110" rx="5" />
              </g>
              <g fill="var(--muted)" fontSize="10" letterSpacing="2">
                <text x="308" y="308">
                  PRODUCTION FLOOR
                </text>
                <text x="539" y="209">
                  WAREHOUSE
                </text>
                <text x="566" y="497">
                  OUTDOOR FACILITY
                </text>
                <text x="54" y="145">
                  ACCESS ROAD
                </text>
              </g>
              {coverage &&
                data.gateways.map((g) => {
                  const p = project(g.location.lat, g.location.lng);
                  return (
                    <g key={g.id}>
                      {[110, 210, 310].map((r) => (
                        <circle
                          key={r}
                          cx={p.x}
                          cy={p.y}
                          r={r * zoom}
                          fill="#aade6b"
                          fillOpacity=".018"
                          stroke="#aade6b"
                          strokeOpacity=".18"
                          strokeDasharray="5 7"
                        />
                      ))}
                    </g>
                  );
                })}
              {data.links.map((l) => {
                const a = devices.find((d) => d.id === l.source),
                  b = devices.find((d) => d.id === l.target);
                if (!a || !b) return null;
                const p = project(a.location.lat, a.location.lng),
                  q = project(b.location.lat, b.location.lng);
                return (
                  <line
                    key={l.id}
                    x1={p.x}
                    y1={p.y}
                    x2={q.x}
                    y2={q.y}
                    stroke={l.status === "offline" ? "#ee7777" : "#b8e66c"}
                    strokeOpacity=".5"
                    strokeDasharray="5 6"
                  />
                );
              })}
              {devices.map((d) => {
                const p = project(d.location.lat, d.location.lng);
                const isGateway = data.gateways.some((g) => g.id === d.id);
                return (
                  <g
                    className="map-pin"
                    role="button"
                    tabIndex={0}
                    aria-label={`View location ${d.id}`}
                    key={d.id}
                    onClick={() => setSelected(d.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setSelected(d.id);
                    }}
                  >
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="24"
                      fill={isGateway ? "#203735" : "#293225"}
                      stroke={
                        d.status === "offline"
                          ? "#ee7777"
                          : isGateway
                            ? "#63c9e7"
                            : "#b8e66c"
                      }
                      strokeWidth="1.5"
                    />
                    <rect
                      x={p.x - 7}
                      y={p.y - 8}
                      width="14"
                      height="16"
                      rx="3"
                      stroke={isGateway ? "#63c9e7" : "#b8e66c"}
                      fill="none"
                    />
                    <rect
                      x={p.x - 42}
                      y={p.y + 32}
                      width="84"
                      height="25"
                      rx="5"
                      fill="var(--panel)"
                      stroke="var(--border)"
                    />
                    <text
                      x={p.x}
                      y={p.y + 49}
                      textAnchor="middle"
                      fontSize="11"
                      fill="var(--text)"
                    >
                      {d.id}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="map-controls">
              <button
                onClick={() => setZoom((z) => Math.min(1.8, z + 0.2))}
                aria-label="Zoom map in"
              >
                <Plus size={18} />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
                aria-label="Zoom map out"
              >
                <Minus size={18} />
              </button>
              <button onClick={() => setZoom(1)} aria-label="Reset map">
                <RotateCcw size={17} />
              </button>
              <button
                onClick={() => setCoverage(!coverage)}
                className={coverage ? "green" : ""}
                aria-label="Toggle coverage"
              >
                <Layers size={17} />
              </button>
            </div>
            <div className="map-attribution">
              Vandoot · Offline site map · WGS84 coordinates
            </div>
          </div>
        </Panel>
        <Panel
          title="Locations"
          subtitle={`${devices.length} positioned devices`}
        >
          <div className="location-list">
            {devices.map((d) => (
              <button
                className={selected === d.id ? "selected" : ""}
                onClick={() => setSelected(d.id)}
                key={d.id}
              >
                <MapPin size={19} />
                <span>
                  <strong>{d.id}</strong>
                  <small>{d.location.label}</small>
                </span>
                <i
                  className={d.status === "offline" ? "red-dot" : "green-dot"}
                />
              </button>
            ))}
          </div>
          {device && (
            <div className="location-detail">
              <StatusBadge status={device.status} />
              <h3>{device.name}</h3>
              <DetailGrid
                items={[
                  ["Latitude", device.location.lat.toFixed(6)],
                  ["Longitude", device.location.lng.toFixed(6)],
                ]}
              />
              <a
                className="button"
                href={
                  data.nodes.some((n) => n.id === device.id)
                    ? `#nodes/${device.id}`
                    : "#gateway"
                }
              >
                View device details →
              </a>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
