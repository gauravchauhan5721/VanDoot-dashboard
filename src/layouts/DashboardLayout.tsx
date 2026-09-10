"use client";
import { ReactNode, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Bell,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Cpu,
  FileChartColumn,
  HeartPulse,
  LayoutDashboard,
  Logs,
  MapPin,
  Menu,
  Network,
  Radio,
  Search,
  Server,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Sparkles,
  X,
  Zap,
  CalendarDays,
  RefreshCw,
} from "lucide-react";
import { navigation, pageDescriptions } from "@/config/dashboard";
import { useDashboard } from "@/hooks/useDashboard";
import { download } from "@/utils/format";
import { Modal } from "@/components/ui";
const icons: Record<string, typeof Activity> = {
  Activity,
  Bell,
  ChartNoAxesCombined,
  Cpu,
  FileChartColumn,
  HeartPulse,
  LayoutDashboard,
  Logs,
  MapPin,
  Network,
  Radio,
  Server,
  Settings: SettingsIcon,
  SlidersHorizontal,
  Sparkles,
};
export function DashboardLayout({
  view,
  children,
}: {
  view: string;
  children: ReactNode;
}) {
  const { data, settings, saveSettings, error, refresh, notify, loading } =
    useDashboard();
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);
  const [help, setHelp] = useState(false);
  const [account, setAccount] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const page = view.split("/")[0];
  const item = navigation.flatMap((s) => s.items).find((i) => i[0] === page);
  const title = view.startsWith("nodes/")
    ? view.split("/")[1]
    : item?.[1] || "Overview";
  const alertCount = data.alerts.filter(
    (a) => a.state === "active" && a.severity !== "info",
  ).length;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setFocused(false);
        setMobile(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    setMobile(false);
  }, [view]);
  const results = [
    ...data.nodes.map((n) => ({
      id: `nodes/${n.id}`,
      name: `${n.id} · ${n.name}`,
      category: "Device",
    })),
    ...navigation.flatMap((s) =>
      s.items.map((i) => ({ id: i[0], name: i[1], category: "Page" })),
    ),
  ]
    .filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 7);
  return (
    <div className="app-shell">
      {mobile && (
        <div className="sidebar-scrim" onClick={() => setMobile(false)} />
      )}
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <a href="#overview" className="brand">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <span>
            VANDOOT<small>CONNECTED. INTELLIGENT.</small>
          </span>
        </a>
        <div className="workspace-selector">
          <span className="workspace-icon">
            <Network size={17} />
          </span>
          <span>
            Main workspace<small>Industrial IoT network</small>
          </span>
          <a href="#settings" aria-label="Workspace settings">
            <ChevronDown size={14} />
          </a>
        </div>
        <nav>
          {navigation.map((section) => (
            <div className="nav-section" key={section.section}>
              <p>{section.section}</p>
              {section.items.map(([id, label, icon]) => {
                const Icon = icons[icon] || Activity;
                return (
                  <a
                    href={`#${id}`}
                    className={`nav-item ${page === id ? "active" : ""}`}
                    key={id}
                  >
                    <Icon size={17} strokeWidth={1.7} />
                    <span>{label}</span>
                    {id === "alerts" && alertCount > 0 && (
                      <b className="nav-count">{alertCount}</b>
                    )}
                    {id === "live-monitoring" && <i className="nav-live-dot" />}
                    {id === "intelligence" && <b className="beta-tag">BETA</b>}
                  </a>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-card">
            <span>
              <span className="demo-orbit">
                <Zap size={13} />
              </span>
              {settings.mode === "demo"
                ? "Demo environment"
                : "Live environment"}
              <i className="status-dot" />
            </span>
            <p>
              {settings.mode === "demo"
                ? "Explore freely. No hardware needed."
                : "Connected to your configured backend."}
            </p>
            <a href="#settings">
              {settings.mode === "demo"
                ? "Configure live connection"
                : "Connection settings"}
              <ArrowRight size={13} />
            </a>
          </div>
          <button className="help-button" onClick={() => setHelp(true)}>
            <CircleHelp size={17} />
            <span>Help & documentation</span>
            <ArrowRight size={14} />
          </button>
          <div className="sidebar-version">
            <span>Vandoot v1.0.0</span>
            <span>
              <i className="status-dot" />{" "}
              {settings.mode === "demo"
                ? "Demo active"
                : error
                  ? "Disconnected"
                  : "Connected"}
            </span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span className="breadcrumb-logo">
              <Network size={16} />
            </span>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <div className="global-search">
              <Search size={15} />
              <input
                ref={searchRef}
                value={search}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 150)}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search anything…"
                aria-label="Search dashboard"
              />
              <kbd>⌘ K</kbd>
              {focused && (
                <div className="search-results">
                  {results.length ? (
                    results.map((r) => (
                      <a
                        key={r.id}
                        href={`#${r.id}`}
                        onClick={() => {
                          setSearch("");
                          setFocused(false);
                        }}
                      >
                        <Search size={14} />
                        <span>{r.name}</span>
                        <small>{r.category}</small>
                      </a>
                    ))
                  ) : (
                    <p>No matching devices or pages.</p>
                  )}
                </div>
              )}
            </div>
            <div className="mode-switch" aria-label="Data mode">
              <button
                className={settings.mode === "demo" ? "active" : ""}
                onClick={() => {
                  if (settings.mode !== "demo")
                    void saveSettings({ ...settings, mode: "demo" });
                }}
              >
                <span />
                Demo
              </button>
              <button
                className={settings.mode === "live" ? "active" : ""}
                onClick={() => {
                  if (settings.mode !== "live")
                    void saveSettings({ ...settings, mode: "live" });
                }}
              >
                Live
              </button>
            </div>
            <span className="topbar-divider" />
            <a
              href="#alerts"
              className="notification-button"
              aria-label={`${alertCount} active alerts`}
            >
              <Bell size={18} />
              {alertCount > 0 && <i />}
            </a>
            <button
              className="avatar"
              aria-label="Open workspace profile"
              onClick={() => setAccount(true)}
            >
              AD
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div className="page-title-line">
              <div>
                <div className="title-row">
                  <h1>{title}</h1>
                  {page === "overview" && (
                    <span className={`system-pill ${error ? "error" : ""}`}>
                      <i />
                      {error ? "Connection unavailable" : "System operational"}
                    </span>
                  )}
                </div>
                <p>
                  {pageDescriptions[page] ||
                    "A closer look at your connected sensor node."}
                </p>
              </div>
              <div className="page-actions">
                <span className="date-display">
                  <CalendarDays size={14} />
                  {new Date().toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <button
                  className="button export-button"
                  onClick={() => {
                    if (!data.logs.length) {
                      notify(
                        "No telemetry to export. Connect a gateway or enable Demo Mode.",
                      );
                      return;
                    }
                    download(
                      `vandoot-${page}-${settings.mode}.csv`,
                      data.logs.map((l) => ({ ...l, source: settings.mode })),
                    );
                    notify("Telemetry exported as CSV");
                  }}
                >
                  <ArrowDownToLine size={14} />
                  Export data
                </button>
              </div>
            </div>
            <div className="heading-status">
              <span>
                <i className={error ? "red-dot" : "status-dot"} />
                {settings.mode === "demo" ? "DEMO MODE" : "LIVE MODE"}
                <span className="dot-separator">·</span>
                {settings.mode === "demo"
                  ? "Simulated data. Real possibilities."
                  : error
                    ? "Hardware not connected"
                    : "Gateway telemetry"}
              </span>
              <span>
                <RefreshCw size={11} className={loading ? "spin" : ""} />
                Updated {loading ? "…" : "just now"}
                <span className="dot-separator">·</span>Every{" "}
                {settings.refreshInterval}s
              </span>
            </div>
          </div>
          {error && (
            <div className="connection-banner">
              <Radio size={20} />
              <div>
                <strong>Live gateway unavailable</strong>
                <p>{error} No simulated hardware data is shown in Live Mode.</p>
              </div>
              <button className="button" onClick={refresh}>
                Retry connection
              </button>
              <a className="button primary" href="#settings">
                Configure gateway
              </a>
            </div>
          )}
          {children}
          <footer className="main-footer">
            <span>
              <span className="mini-brand">∨</span>VANDOOT <i>·</i> Intelligent
              Distributed Monitoring & Communication
            </span>
            <span>
              <span className="status-dot" />
              {settings.mode === "demo"
                ? "Demo environment"
                : "Live environment"}
              <i>·</i>v1.0.0
            </span>
          </footer>
        </main>
      </div>
      {help && (
        <Modal title="Welcome to Vandoot" onClose={() => setHelp(false)}>
          <div className="modal-body">
            <p>Your intelligent distributed monitoring workspace.</p>
            <h3>Explore the demo</h3>
            <p>
              All telemetry is simulated. Select a node to inspect its sensors,
              zoom the LoRaMesh topology, acknowledge alerts, or simulate a
              device command. No physical hardware is required.
            </p>
            <h3>Connect your gateway</h3>
            <p>
              Open Settings → Connectivity and enter your Raspberry Pi API and
              WebSocket URLs. Switch to Live Mode. See README.md in the project
              for the complete API contract, installation steps, and
              configuration guide.
            </p>
            <h3>Keyboard shortcuts</h3>
            <p>Ctrl / ⌘ + K opens search. Escape closes dialogs.</p>
            <a
              className="button primary"
              href="#settings"
              onClick={() => setHelp(false)}
            >
              Open settings
              <ArrowRight size={15} />
            </a>
          </div>
        </Modal>
      )}
      {account && (
        <Modal title="Workspace profile" onClose={() => setAccount(false)}>
          <div className="modal-body">
            <span className="avatar big">AD</span>
            <h3>Administrator · Local workspace</h3>
            <p>
              This is a single-user local dashboard. Authentication and
              role-based permissions are not enabled. Do not expose this
              application publicly without adding authentication.
            </p>
            <a
              className="button"
              href="#settings"
              onClick={() => setAccount(false)}
            >
              Manage workspace
            </a>
          </div>
        </Modal>
      )}
    </div>
  );
}
