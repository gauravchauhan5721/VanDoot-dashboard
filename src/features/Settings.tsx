"use client";
import { useEffect, useState } from "react";
import {
  Check,
  Globe,
  LoaderCircle,
  Moon,
  Radio,
  RotateCcw,
  Save,
  Sun,
} from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import { defaultSettings } from "@/config/dashboard";
import { sensors } from "@/config/sensors";
import { nodeConfigs } from "@/config/nodes";
import { Panel } from "@/components/ui";
import { Settings as SettingsType } from "@/types";
export function Settings() {
  const { settings, saveSettings, data, notify } = useDashboard();
  const [draft, setDraft] = useState<SettingsType>(settings);
  const [tab, setTab] = useState("general");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [connection, setConnection] = useState("");
  useEffect(() => setDraft(settings), [settings]);
  const change = <K extends keyof SettingsType>(
    key: K,
    value: SettingsType[K],
  ) => setDraft((d) => ({ ...d, [key]: value }));
  const save = async () => {
    setBusy(true);
    await saveSettings(draft);
    setBusy(false);
  };
  const testConnection = async () => {
    if (!draft.apiEndpoint) {
      setConnection("Enter a gateway API URL first.");
      return;
    }
    setChecking(true);
    try {
      const url = new URL(draft.apiEndpoint);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error("Use an HTTP(S) URL without credentials");
      const response = await fetch(
        `${draft.apiEndpoint.replace(/\/$/, "")}/gateway`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      const gateway = Array.isArray(body) ? body[0] : body;
      if (!gateway?.id)
        throw new Error("Response does not match the gateway contract");
      setConnection(`Connection successful · ${gateway.id}`);
    } catch (e) {
      setConnection(
        `Connection failed: ${e instanceof Error ? e.message : "Gateway unavailable"}. Check the URL, CORS, and gateway service.`,
      );
    } finally {
      setChecking(false);
    }
  };
  return (
    <>
      <div className="settings-tabs">
        {[
          ["general", "General"],
          ["connectivity", "Connectivity"],
          ["thresholds", "Alert thresholds"],
          ["devices", "Device configuration"],
        ].map(([id, label]) => (
          <button
            className={tab === id ? "active" : ""}
            key={id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {tab === "general" && (
          <div className="two-column">
            <Panel
              title="Environment"
              subtitle="Choose how your dashboard receives data"
            >
              <div className="settings-form">
                <div className="mode-options">
                  {(["demo", "live"] as const).map((mode) => (
                    <button
                      type="button"
                      key={mode}
                      className={draft.mode === mode ? "selected" : ""}
                      onClick={() => change("mode", mode)}
                    >
                      <span>
                        {mode === "demo" ? (
                          <Radio size={23} />
                        ) : (
                          <Globe size={23} />
                        )}
                        <i>{draft.mode === mode && <Check size={13} />}</i>
                      </span>
                      <strong>
                        {mode === "demo" ? "Demo Mode" : "Live Mode"}
                      </strong>
                      <p>
                        {mode === "demo"
                          ? "Realistic simulation. No hardware needed."
                          : "Connect to your real Raspberry Pi gateway."}
                      </p>
                    </button>
                  ))}
                </div>
                <label>
                  Refresh interval (seconds)
                  <input
                    type="number"
                    min="2"
                    max="300"
                    value={draft.refreshInterval}
                    required
                    onChange={(e) =>
                      change("refreshInterval", Number(e.target.value))
                    }
                  />
                  <small>Between 2 and 300 seconds. Default: 5 seconds.</small>
                </label>
              </div>
            </Panel>
            <Panel
              title="Appearance & units"
              subtitle="Personalize your monitoring workspace"
            >
              <div className="settings-form">
                <label>Theme</label>
                <div className="theme-options">
                  <button
                    type="button"
                    className={draft.theme === "dark" ? "selected" : ""}
                    onClick={() => change("theme", "dark")}
                  >
                    <Moon size={19} />
                    Dark
                  </button>
                  <button
                    type="button"
                    className={draft.theme === "light" ? "selected" : ""}
                    onClick={() => change("theme", "light")}
                  >
                    <Sun size={19} />
                    Light
                  </button>
                </div>
                <label>
                  Temperature display
                  <select
                    value={draft.units}
                    onChange={(e) =>
                      change("units", e.target.value as SettingsType["units"])
                    }
                  >
                    <option value="metric">Metric · Celsius (°C)</option>
                    <option value="imperial">Imperial · Fahrenheit (°F)</option>
                  </select>
                  <small>
                    Thresholds, raw telemetry exports, and the sensor registry
                    use canonical metric units.
                  </small>
                </label>
              </div>
            </Panel>
          </div>
        )}
        {tab === "connectivity" && (
          <Panel
            title="Raspberry Pi connectivity"
            subtitle="Public endpoint URLs only. Never put passwords or API tokens in these fields."
          >
            <div className="settings-form max-width">
              <label>
                Gateway API base URL
                <input
                  type="url"
                  placeholder="http://192.168.1.100:8000/api"
                  value={draft.apiEndpoint}
                  onChange={(e) => change("apiEndpoint", e.target.value)}
                />
                <small>
                  The base URL includes /api. Vandoot requests /gateway, /nodes,
                  /sensors, /network, /alerts, /logs and /analytics.
                </small>
              </label>
              <label>
                WebSocket endpoint
                <input
                  type="url"
                  placeholder="ws://192.168.1.100:8000/api/live"
                  value={draft.wsEndpoint}
                  onChange={(e) => change("wsEndpoint", e.target.value)}
                />
                <small>
                  Optional. REST polling continues if WebSocket is not
                  configured. Reconnects every five seconds.
                </small>
              </label>
              <div>
                <button
                  type="button"
                  className="button"
                  disabled={checking}
                  onClick={() => void testConnection()}
                >
                  {checking ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <Radio size={15} />
                  )}
                  Test connection
                </button>
              </div>
              {connection && <div className="info-banner">{connection}</div>}
              <div className="settings-note">
                <strong>Integration notes</strong>
                <p>
                  Use NEXT_PUBLIC_GATEWAY_API_URL and NEXT_PUBLIC_GATEWAY_WS_URL
                  as defaults. An HTTPS dashboard needs HTTPS / WSS endpoints.
                  Your gateway must allow the dashboard origin through CORS.
                  Private tokens belong in a server-side proxy, not the browser.
                </p>
              </div>
            </div>
          </Panel>
        )}
        {tab === "thresholds" && (
          <Panel
            title="Central alert thresholds"
            subtitle="Threshold changes apply immediately after saving. Values use the sensor’s canonical units."
          >
            <div className="table-scroll">
              <table className="threshold-table">
                <thead>
                  <tr>
                    <th>Sensor</th>
                    <th>Unit</th>
                    <th>Trigger</th>
                    <th>Warning</th>
                    <th>Critical</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(draft.thresholds).map(([id, threshold]) => (
                    <tr key={id}>
                      <td>{sensors.find((s) => s.id === id)?.name || id}</td>
                      <td>{sensors.find((s) => s.id === id)?.unit}</td>
                      <td>
                        <select
                          aria-label={`${id} direction`}
                          value={threshold.direction}
                          onChange={(e) =>
                            change("thresholds", {
                              ...draft.thresholds,
                              [id]: {
                                ...threshold,
                                direction: e.target.value as "above" | "below",
                              },
                            })
                          }
                        >
                          <option value="above">Above</option>
                          <option value="below">Below</option>
                        </select>
                      </td>
                      <td>
                        <input
                          aria-label={`${id} warning threshold`}
                          type="number"
                          step="any"
                          required
                          value={threshold.warning}
                          onChange={(e) =>
                            change("thresholds", {
                              ...draft.thresholds,
                              [id]: {
                                ...threshold,
                                warning: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`${id} critical threshold`}
                          type="number"
                          step="any"
                          required
                          value={threshold.critical}
                          onChange={(e) =>
                            change("thresholds", {
                              ...draft.thresholds,
                              [id]: {
                                ...threshold,
                                critical: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="settings-note">
              <p>
                For “above” rules, the critical threshold must exceed the
                warning threshold. For “below” rules, it must be lower. Add
                additional sensor rules in src/config/thresholds.ts.
              </p>
            </div>
          </Panel>
        )}
        {tab === "devices" && (
          <>
            <Panel
              title="Gateway configuration"
              subtitle="Workspace display settings"
            >
              <div className="settings-form max-width">
                <label>
                  Primary gateway name
                  <input
                    required
                    value={draft.gatewayName}
                    onChange={(e) => change("gatewayName", e.target.value)}
                  />
                </label>
                <small>
                  Live gateway names are supplied by the gateway API. Demo
                  hardware definitions live in src/config/nodes.ts.
                </small>
              </div>
            </Panel>
            <Panel
              title="Node configuration"
              subtitle="Names affect Demo Mode. Interval values are saved preferences, not hardware commands."
              className="section-gap"
            >
              <div className="table-scroll">
                <table className="node-settings">
                  <thead>
                    <tr>
                      <th>Node</th>
                      <th>Display name</th>
                      <th>Sampling preference (s)</th>
                      <th>Transmission preference (s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.nodes.length ? data.nodes : nodeConfigs).map((n) => {
                      const override = draft.nodeOverrides[n.id] || {};
                      const update = (key: string, value: string | number) =>
                        change("nodeOverrides", {
                          ...draft.nodeOverrides,
                          [n.id]: { ...override, [key]: value },
                        });
                      return (
                        <tr key={n.id}>
                          <td>{n.id}</td>
                          <td>
                            <input
                              aria-label={`${n.id} name`}
                              value={override.name ?? n.name}
                              onChange={(e) => update("name", e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              aria-label={`${n.id} sampling interval`}
                              type="number"
                              min="1"
                              max="86400"
                              value={override.samplingInterval ?? 30}
                              onChange={(e) =>
                                update(
                                  "samplingInterval",
                                  Number(e.target.value),
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              aria-label={`${n.id} transmission interval`}
                              type="number"
                              min="1"
                              max="86400"
                              value={override.transmissionInterval ?? 60}
                              onChange={(e) =>
                                update(
                                  "transmissionInterval",
                                  Number(e.target.value),
                                )
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="settings-note">
                <p>
                  To apply intervals to real hardware, use Device Control with a
                  connected gateway. Demo telemetry follows the global dashboard
                  refresh interval. To add/remove devices or change multi-hop
                  routing, edit src/config/nodes.ts.
                </p>
              </div>
            </Panel>
          </>
        )}
        <div className="settings-save">
          <button
            className="button"
            type="button"
            onClick={() => {
              setDraft({
                ...defaultSettings,
                thresholds: { ...defaultSettings.thresholds },
              });
              notify("Defaults restored in this form. Save changes to apply.");
            }}
          >
            <RotateCcw size={14} />
            Restore defaults
          </button>
          <span className="push muted">Changes are stored in PostgreSQL.</span>
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <Save size={15} />
            )}
            Save changes
          </button>
        </div>
      </form>
    </>
  );
}
