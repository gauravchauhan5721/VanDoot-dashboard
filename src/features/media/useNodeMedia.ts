"use client";
import { useCallback, useEffect, useState } from "react";
import { useDashboard } from "@/hooks/useDashboard";
import { hostedCamera } from "@/config/hostedCamera";
import {
  blankSource,
  MediaSource,
  ModelStatus,
  parseEvents,
  parseThermal,
  safeMediaURL,
  ThermalFrame,
} from "./contracts";

export function useNodeMedia(nodeId: string) {
  const { settings, receiveEvents } = useDashboard();
  const demo = settings.mode === "demo";
  const [source, setSource] = useState<MediaSource>(blankSource);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(true);
  const [frame, setFrame] = useState<ThermalFrame | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus>("unknown");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setReady(false);
    setFrame(null);
    setErrors({});
    setModelStatus("unknown");
    setRunning(true);
    const installation = hostedCamera();
    const published =
      !demo && installation?.nodeId === nodeId ? installation : undefined;
    const defaults = {
      ...blankSource,
      ...(published
        ? { camera: published.camera, events: published.events }
        : {}),
    };
    try {
      const saved = JSON.parse(
        localStorage.getItem(`vandoot-media-${settings.mode}`) || "{}",
      );
      const next = { ...defaults, ...saved[nodeId] };
      for (const key of Object.keys(blankSource) as (keyof MediaSource)[]) {
        try {
          next[key] = safeMediaURL(next[key]);
        } catch {
          next[key] = "";
        }
      }
      if (published) {
        const oldLocal = /^http:\/\/(localhost|127\.0\.0\.1):8765\//;
        if (next.camera === published.oldStream || oldLocal.test(next.camera))
          next.camera = published.camera;
        if (oldLocal.test(next.events)) next.events = published.events;
      }
      setSource(next);
    } catch {
      setSource(defaults);
      setErrors({
        settings: "Saved URLs could not be read. Configure sources to recover.",
      });
    }
    setReady(true);
  }, [nodeId, settings.mode, demo]);
  const save = useCallback(
    (next: MediaSource) => {
      const key = `vandoot-media-${settings.mode}`;
      let saved: Record<string, MediaSource> = {};
      try {
        const value = JSON.parse(localStorage.getItem(key) || "{}");
        if (value && typeof value === "object" && !Array.isArray(value))
          saved = value;
      } catch {
        /* A corrupt saved entry can be recovered through source setup. */
      }
      localStorage.setItem(key, JSON.stringify({ ...saved, [nodeId]: next }));
      setSource(next);
      setFrame(null);
      setErrors({});
      setRunning(true);
    },
    [settings.mode, nodeId],
  );
  useEffect(() => {
    if (!ready || !running || demo) return;
    let active = true;
    const controller = new AbortController();
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    // Independent loops: a blocked model endpoint cannot delay thermal frames.
    const poll = async (kind: "thermal" | "events") => {
      if (!source[kind]) return;
      try {
        const response = await fetch(source[kind], {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(8000),
          ]),
          cache: "no-store",
          credentials: "omit",
        });
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        const body: unknown = await response.json();
        if (!active) return;
        if (kind === "thermal") {
          const next = parseThermal(body, nodeId);
          setFrame((old) =>
            !old || Date.parse(next.timestamp) >= Date.parse(old.timestamp)
              ? next
              : old,
          );
        } else {
          const result = parseEvents(body, nodeId);
          receiveEvents(result.events);
          setModelStatus(result.modelStatus);
        }
        setErrors((old) => ({ ...old, [kind]: "" }));
      } catch (error) {
        if (active)
          setErrors((old) => ({
            ...old,
            [kind]:
              error instanceof Error ? error.message : "Connection failed",
          }));
      } finally {
        if (active)
          timers.set(
            kind,
            setTimeout(() => void poll(kind), 3000),
          );
      }
    };
    void poll("thermal");
    void poll("events");
    return () => {
      active = false;
      controller.abort();
      timers.forEach(clearTimeout);
    };
  }, [demo, ready, running, source, nodeId, attempt, receiveEvents]);
  return {
    source,
    save,
    frame,
    modelStatus,
    errors,
    running,
    setRunning,
    retry: () => setAttempt((v) => v + 1),
    attempt,
    demo,
    ready,
  };
}
