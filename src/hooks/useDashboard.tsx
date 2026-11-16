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
import type { DetectionEvent } from "@/features/media/contracts";
import { eventAlert } from "@/features/media/contracts";
import { isFresh, thresholdAlerts } from "@/utils/telemetry";
import { useClock } from "@/hooks/useClock";
interface DashboardContext {
  mediaEvents: DetectionEvent[];
  receiveEvents: (events: DetectionEvent[]) => void;
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
  const now = useClock();
  const [mediaEvents, setMediaEvents] = useState<DetectionEvent[]>([]);
  const receiveEvents = useCallback(
    (events: DetectionEvent[]) =>
      setMediaEvents((old) =>
        Array.from(
          new Map(
            [...old, ...events].map((e) => [e.nodeId + ":" + e.id, e]),
          ).values(),
        )
          .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
          .slice(0, 200),
      ),
    [],
  );
  const crossings = useRef(new Map<string, string>());
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
  const [actionStates, setActionStates] = useState<
    Record<string, Alert["state"]>
  >({});
  const demo = useRef<DemoDataService | null>(null);
  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    let active = true;
    if (process.env.NEXT_PUBLIC_STATIC_PREVIEW === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- static preview has no persistence service to await.
      setReady(true);
      return;
    }
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
    if (
      process.env.NEXT_PUBLIC_STATIC_PREVIEW === "1" &&
      settings.mode === "live"
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- switching transport must clear the previous mode snapshot immediately.
      setData(emptySnapshot());
      setError(
        "Hosted preview has no local gateway backend. Run the repository locally to connect hardware.",
      );
      setLoading(false);
      return;
    }
    let active = true;
    let busy = false;
    const controller = new AbortController();
    crossings.current.clear();
    setMediaEvents([]);
    setActionStates({});
    if (!demo.current) demo.current = new DemoDataService(settings);
    demo.current.updateSettings(settings);
    const service =
      settings.mode === "demo"
        ? demo.current
        : new LiveApiService(settings.apiEndpoint, controller.signal);
    setData(emptySnapshot());
    setLoading(true);
    setError("");
    const accept = (snapshot: Snapshot) => {
      if (!active) return;
      const generated =
        settings.mode === "live"
          ? thresholdAlerts(snapshot, settings, crossings.current)
          : [];
      setData((previous) => ({
        ...snapshot,
        gateways: snapshot.gateways.length
          ? snapshot.gateways
          : previous.gateways,
        nodes: snapshot.nodes.map((node) => {
          const newer = previous.nodes.find(
            (p) =>
              p.id === node.id &&
              Date.parse(p.lastSeen) > Date.parse(node.lastSeen),
          );
          return newer || node;
        }),
        history:
          settings.mode === "live"
            ? Array.from(
                new Map(
                  [...previous.history, ...snapshot.history].map((p) => [
                    p.nodeId + p.timestamp,
                    p,
                  ]),
                ).values(),
              ).slice(-5000)
            : snapshot.history,
        logs:
          settings.mode === "live"
            ? Array.from(
                new Map(
                  [...snapshot.logs, ...previous.logs].map((p) => [p.id, p]),
                ).values(),
              ).slice(0, 2000)
            : snapshot.logs,
        alerts: (settings.mode === "live"
          ? Array.from(
              new Map(
                [...previous.alerts, ...snapshot.alerts, ...generated].map(
                  (a) => [a.id, a],
                ),
              ).values(),
            )
          : snapshot.alerts
        ).map((a) => ({
          ...a,
          state:
            settings.mode === "demo"
              ? actions.current[a.id] || a.state
              : a.state,
        })),
      }));
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
          setData((current) => ({
            ...current,
            nodes: current.nodes.map((n) => ({ ...n, status: "offline" })),
          }));
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
      controller.abort();
    };
  }, [ready, settings, paused, version]);

  const saveSettings = async (next: Settings) => {
    try {
      // Update the UI mode immediately
      setSettings(next);
      if (process.env.NEXT_PUBLIC_STATIC_PREVIEW === "1") {
        notify("Preview preferences changed for this session; not persisted.");
        return true;
      }

      // Session preferences remain usable when persistence is unavailable.
      let persisted = false;
      try {
        const response = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });

        if (response.ok) {
          setDatabase(true);
          persisted = true;
        } else {
          setDatabase(false);
        }
      } catch {
        setDatabase(false);
      }

      notify(
        persisted
          ? "Settings saved"
          : "Settings applied for this session. PostgreSQL is unavailable; changes are not saved.",
      );

      return true;
    } catch {
      notify("Unable to change mode");
      return false;
    }
  };

  const updateAlert = async (id: string, state: Alert["state"]) => {
    try {
      if (
        settings.mode === "live" &&
        (id.startsWith("threshold:") || id.startsWith("media:"))
      ) {
        notify(
          "Review this observation in Incident review; saving requires workspace access.",
        );
        return;
      }
      if (settings.mode === "live")
        await new LiveApiService(settings.apiEndpoint).updateAlert(id, state);
      else if (process.env.NEXT_PUBLIC_STATIC_PREVIEW === "1") {
        actions.current[id] = state;
      } else {
        const response = await fetch("/api/alerts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, state }),
        });
        if (!response.ok) throw new Error("Unable to save alert action");
        actions.current[id] = state;
      }
      setActionStates((old) => ({ ...old, [id]: state }));
      setData((current) => ({
        ...current,
        alerts: current.alerts.map((a) => (a.id === id ? { ...a, state } : a)),
      }));
      notify(
        `Alert ${state}${process.env.NEXT_PUBLIC_STATIC_PREVIEW === "1" ? " for this demo session" : ""}`,
      );
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
        data: {
          ...data,
          gateways:
            settings.mode === "live"
              ? data.gateways.map((g) =>
                  isFresh(
                    g.lastSeen,
                    Math.max(now, Date.parse(data.timestamp) || 0),
                  )
                    ? g
                    : {
                        ...g,
                        status: "offline",
                        cpu: NaN,
                        ram: NaN,
                        storage: NaN,
                        temperature: NaN,
                      },
                )
              : data.gateways,
          nodes:
            settings.mode === "live"
              ? data.nodes.map((node) =>
                  node.status !== "offline" &&
                  isFresh(
                    node.lastSeen,
                    Math.max(now, Date.parse(data.timestamp) || 0),
                  )
                    ? node
                    : {
                        ...node,
                        status: "offline",
                        readings: Object.fromEntries(
                          Object.keys(node.readings).map((key) => [key, NaN]),
                        ),
                      },
                )
              : data.nodes,
          alerts: [
            ...data.alerts,
            ...mediaEvents
              .filter(
                (e) =>
                  !data.alerts.some(
                    (a) => a.evidence?.id === e.id && a.nodeId === e.nodeId,
                  ),
              )
              .map(eventAlert),
          ].map((a) => ({ ...a, state: actionStates[a.id] || a.state })),
        },
        mediaEvents,
        receiveEvents,
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
