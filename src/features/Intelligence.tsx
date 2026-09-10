"use client";
import {
  Battery,
  ChartNoAxesCombined,
  Cpu,
  Network,
  Sparkles,
  Thermometer,
} from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import { EmptyState, Panel } from "@/components/ui";
export function Intelligence() {
  const { data, settings } = useDashboard();
  if (settings.mode !== "demo")
    return (
      <Panel>
        <EmptyState
          title="No AI model connected"
          description="Live AI inference is not configured. Connect a model service in a future integration, or enable Demo Mode to explore simulated insights."
        />
      </Panel>
    );
  const weakest = [...data.nodes].sort(
    (a, b) => a.readings.rssi - b.readings.rssi,
  )[0];
  const battery = [...data.nodes].sort(
    (a, b) => a.readings.battery - b.readings.battery,
  )[0];
  const hottest = [...data.nodes].sort(
    (a, b) => b.readings.temperature - a.readings.temperature,
  )[0];
  const insights = [
    {
      icon: Network,
      title: "Optimize your mesh coverage",
      category: "Network optimization",
      text: `${weakest?.id || "A node"} has the lowest signal at ${weakest?.readings.rssi || "—"} dBm. Repositioning its antenna may improve link resilience.`,
      action: "Explore network",
      href: "network",
      color: "cyan",
    },
    {
      icon: Battery,
      title: "Battery maintenance outlook",
      category: "Predictive maintenance",
      text: `${battery?.id || "A node"} reports ${battery?.readings.battery.toFixed(0) || "—"}% battery. Using a demonstration assumption of 2% drain per day, approximately ${Math.max(0, Math.floor(((battery?.readings.battery || 0) - 10) / 2))} days remain before the critical threshold.`,
      action: "Inspect node",
      href: `nodes/${battery?.id || ""}`,
      color: "green",
    },
    {
      icon: Thermometer,
      title: "Temperature pattern detected",
      category: "Sensor anomaly detection",
      text: `${hottest?.id || "A node"} is the warmest node at ${hottest?.readings.temperature.toFixed(1) || "—"} °C. Compare its trend against nearby sensors before taking action.`,
      action: "Analyze temperature",
      href: "analytics/temperature",
      color: "amber",
    },
    {
      icon: Cpu,
      title: "Node reliability watch",
      category: "Node failure prediction",
      text: "Correlate battery level, packet loss, and signal strength to identify devices that may need inspection. This demo uses simple heuristic rules, not a trained model.",
      action: "Review node health",
      href: "nodes",
      color: "purple",
    },
    {
      icon: ChartNoAxesCombined,
      title: "Environmental trend summary",
      category: "Trend analysis",
      text: "Sensor readings follow a smooth daily pattern in this simulation. Compare historical minimum, maximum, and average values across all nodes.",
      action: "Open analytics",
      href: "analytics",
      color: "cyan",
    },
    {
      icon: Sparkles,
      title: "Prioritize actionable events",
      category: "Intelligent alerts",
      text: `${data.alerts.filter((a) => a.state === "active").length} unacknowledged events are ready for review. Start with critical events, then inspect recurring warnings.`,
      action: "Review alerts",
      href: "alerts",
      color: "green",
    },
  ];
  return (
    <>
      <div className="intelligence-banner">
        <span className="intelligence-icon">
          <Sparkles size={30} />
        </span>
        <div>
          <h2>Your network has a story. Let’s understand it.</h2>
          <p>
            Explore the possibilities of predictive monitoring and intelligent
            operations.
          </p>
        </div>
        <span className="demo-tag">DEMO INSIGHTS</span>
      </div>
      <div className="info-banner">
        <Sparkles size={17} />
        All insights below are simulated, rule-based demonstrations. No real ML
        model or predictive AI is connected.
      </div>
      <div className="three-column">
        {insights.map((insight, index) => (
          <Panel key={insight.title}>
            <div className="insight-card">
              <div>
                <span className={`insight-icon ${insight.color}`}>
                  <insight.icon size={23} />
                </span>
                <span className="demo-tag">DEMO</span>
              </div>
              <small>{insight.category}</small>
              <h3>{insight.title}</h3>
              <p>{insight.text}</p>
              <div className="insight-bottom">
                <span>INSIGHT {String(index + 1).padStart(2, "0")}</span>
                <a href={`#${insight.href}`}>{insight.action} →</a>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
