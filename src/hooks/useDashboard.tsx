"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import {
  Alert,
  CommandResult,
  DeviceCommand,
  Settings,
  Snapshot,
} from "@/types";
import { defaultSettings } from "@/config/dashboard";
import { DemoDataService, emptySnapshot } from "@/services/DemoDataService";
import { LiveApiService } from "@/services/LiveApiService";
import { WebSocketService } from "@/services/WebSocketService";
interface DashboardContext {
  data: Snapshot;
  settings: Settings;
  loading: boolean;
  error: string;
  wsStatus: string;
  database: boolean;
  paused: boolean;
  setPaused: (v: boolean) => void;
  saveSettings: (s: Settings) => Promise<boolean>;
  updateAlert: (id: string, state: Alert["state"]) => Promise<void>;
  sendCommand: (c: DeviceCommand) => Promise<CommandResult>;
  refresh: () => void;
  notify: (message: string) => void;
}
const Context = createContext<DashboardContext | null>(null);
export function DashboardProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Snapshot>(emptySnapshot);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [wsStatus, setWsStatus] = useState("Demo stream");
  const [database, setDatabase] = useState(false);
  const [paused, setPaused] = useState(false);
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState("");
  const actions = useRef<Record<string, Alert["state"]>>({});
  const demo = useRef<DemoDataService | null>(null);
  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/settings").then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      }),
      fetch("/api/alerts").then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      }),
    ])
      .then(([saved, stored]) => {
        if (!active) return;
        if (saved)
          setSettings({
            ...defaultSettings,
            ...saved,
            thresholds: { ...defaultSettings.thresholds, ...saved.thresholds },
          });
        actions.current = Object.fromEntries(
          stored.map((a: { id: string; state: Alert["state"] }) => [
            a.id,
            a.state,
          ]),
        );
        setDatabase(true);
      })
      .catch(() => {
        if (active)
          notify(
            "Database unavailable. Demo telemetry works; persistent actions need PostgreSQL.",
          );
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [notify]);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    let busy = false;
    if (!demo.current) demo.current = new DemoDataService(settings);
    demo.current.updateSettings(settings);
    const service =
      settings.mode === "demo"
        ? demo.current
        : new LiveApiService(settings.apiEndpoint);
    setData(emptySnapshot());
    setLoading(true);
    setError("");
    const accept = (snapshot: Snapshot) => {
      if (!active) return;
      setData({
        ...snapshot,
        alerts: snapshot.alerts.map((a) => ({
          ...a,
          state:
            settings.mode === "demo"
              ? actions.current[a.id] || a.state
              : a.state,
        })),
      });
      setError("");
      setLoading(false);
    };
    const poll = async () => {
      if (busy || !active) return;
      busy = true;
      try {
        accept(await service.getSnapshot());
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "Connection failed");
          setLoading(false);
        }
      } finally {
        busy = false;
      }
    };
    void poll();
    const timer = paused
      ? undefined
      : setInterval(poll, settings.refreshInterval * 1000);
    const ws = new WebSocketService();
    if (settings.mode === "live" && !paused)
      ws.connect(settings.wsEndpoint, accept, setWsStatus);
    else setWsStatus(settings.mode === "demo" ? "Demo stream" : "Paused");
    return () => {
      active = false;
      clearInterval(timer);
      ws.disconnect();
    };
  }, [ready, settings, paused, version]);
  const saveSettings = async (next: Settings) => {
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setSettings(next);
      setDatabase(true);
      notify("Settings saved");
      return true;
    } catch (e) {
      notify(e instanceof Error ? e.message : "Unable to save settings");
      return false;
    }
  };
  const updateAlert = async (id: string, state: Alert["state"]) => {
    try {
      if (settings.mode === "live")
        await new LiveApiService(settings.apiEndpoint).updateAlert(id, state);
      else {
        const response = await fetch("/api/alerts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, state }),
        });
        if (!response.ok) throw new Error("Unable to save alert action");
        actions.current[id] = state;
      }
      setData((current) => ({
        ...current,
        alerts: current.alerts.map((a) => (a.id === id ? { ...a, state } : a)),
      }));
      notify(`Alert ${state}`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Action failed");
    }
  };
  const sendCommand = async (
    command: DeviceCommand,
  ): Promise<CommandResult> => {
    if (settings.mode === "live")
      return new LiveApiService(settings.apiEndpoint).sendCommand(command);
    await demo.current?.sendCommand(command);
    const response = await fetch("/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...command, mode: "demo" }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    return result;
  };
  return (
    <Context.Provider
      value={{
        data,
        settings,
        loading,
        error,
        wsStatus,
        database,
        paused,
        setPaused,
        saveSettings,
        updateAlert,
        sendCommand,
        refresh: () => setVersion((v) => v + 1),
        notify,
      }}
    >
      {children}
      {toast && (
        <div className="toast" role="status">
          <span className="status-dot" />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export function useDashboard() {
  const context = useContext(Context);
  if (!context) throw new Error("DashboardProvider is required");
  return context;
}
