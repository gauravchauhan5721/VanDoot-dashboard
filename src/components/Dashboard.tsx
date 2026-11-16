"use client";
import { useEffect, useState } from "react";
import { DashboardProvider, useDashboard } from "@/hooks/useDashboard";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { NodeMedia } from "@/features/NodeMedia";
import { Overview } from "@/features/Overview";
import { Nodes } from "@/features/Nodes";
import {
  GatewayPage,
  LiveMonitoring,
  NetworkPage,
  SensorsPage,
  SystemHealth,
} from "@/features/Monitoring";
import { Analytics } from "@/features/Analytics";
import { Alerts } from "@/features/Alerts";
import { DataLogs } from "@/features/DataLogs";
import { MapPage } from "@/features/MapPage";
import { Intelligence } from "@/features/Intelligence";
import { DeviceControl, Reports } from "@/features/Operations";
import { Settings } from "@/features/Settings";
import dynamic from "next/dynamic";
import { ForestWorkspace } from "@/features/forest/ForestWorkspace";
import { modules, ForestModule } from "@/features/forest/contracts";
const Simulation = dynamic(
  () => import("@/features/Simulation").then((m) => m.Simulation),
  { ssr: false, loading: () => <LoadingState /> },
);
import { EmptyState, LoadingState, Panel } from "./ui";
function Application() {
  const [view, setView] = useState("overview");
  const { loading, data, error } = useDashboard();
  useEffect(() => {
    const navigate = (event?: HashChangeEvent) => {
      if (event && window.location.hash.startsWith("#alerts/"))
        window.history.replaceState(
          { ...window.history.state, vandootEvidence: true },
          "",
        );
      setView(window.location.hash.slice(1) || "overview");
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    navigate();
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  const [path, query = ""] = view.split("?");
  const [page, rawId, extra] = path.split("/");
  let id: string | undefined = rawId;
  let detailId: string | undefined;
  try {
    id = rawId ? decodeURIComponent(rawId) : rawId;
    detailId = extra ? decodeURIComponent(extra) : undefined;
  } catch {
    id = undefined;
  }
  let content;
  switch (page) {
    case "forest":
      content = modules.includes(id as ForestModule) ? (
        <ForestWorkspace
          key={
            id +
            (extra || "") +
            Boolean(data.alerts.find((a) => a.id === detailId))
          }
          module={id as ForestModule}
          queryString={query}
          alertId={detailId}
        />
      ) : (
        <EmptyState title="Unknown forest workspace" />
      );
      break;
    case "node-media":
      content = <NodeMedia nodeId={id} />;
      break;
    case "overview":
      content = <Overview nodeId={id} />;
      break;
    case "live-monitoring":
      content = <LiveMonitoring />;
      break;
    case "nodes":
      content = <Nodes nodeId={id} />;
      break;
    case "simulation":
      content = <Simulation />;
      break;
    case "network":
      content = <NetworkPage />;
      break;
    case "gateway":
      content = <GatewayPage />;
      break;
    case "sensors":
      content = <SensorsPage />;
      break;
    case "analytics":
      content = <Analytics key={view} sensorId={id} nodeId={detailId} />;
      break;
    case "alerts":
      content = <Alerts alertId={id} queryString={query} />;
      break;
    case "map":
      content = <MapPage />;
      break;
    case "intelligence":
      content = <Intelligence />;
      break;
    case "device-control":
      content = <DeviceControl key={view} targetId={id} />;
      break;
    case "data-logs":
      content = <DataLogs />;
      break;
    case "reports":
      content = <Reports />;
      break;
    case "system-health":
      content = <SystemHealth />;
      break;
    case "settings":
      content = <Settings />;
      break;
    default:
      content = (
        <Panel>
          <EmptyState
            title="Page not found"
            description="Choose a workspace page from the sidebar."
            action={
              <a className="button" href="#overview">
                Back to Overview
              </a>
            }
          />
        </Panel>
      );
  }
  return (
    <DashboardLayout view={view}>
      {loading &&
      !data.nodes.length &&
      ![
        "settings",
        "system-health",
        "simulation",
        "node-media",
        "forest",
      ].includes(page) ? (
        <LoadingState />
      ) : error &&
        !data.nodes.length &&
        [
          "overview",
          "gateway",
          "network",
          "sensors",
          "live-monitoring",
          "map",
        ].includes(page) ? (
        <Panel>
          <EmptyState
            title="Waiting for your gateway"
            description="No hardware telemetry is available. Configure your Raspberry Pi connection, or switch to Demo Mode."
            action={
              <a href="#settings" className="button primary">
                Connection settings
              </a>
            }
          />
        </Panel>
      ) : (
        content
      )}
    </DashboardLayout>
  );
}
export default function Dashboard() {
  return (
    <DashboardProvider>
      <Application />
    </DashboardProvider>
  );
}
