"use client";
import { useDashboard } from "@/hooks/useDashboard";
import { EmptyState, Panel } from "@/components/ui";
import { NodeConsole } from "./media/NodeConsole";
export function NodeMedia({ nodeId }: { nodeId?: string }) {
  const { data, settings } = useDashboard();
  const selected = data.nodes.find((n) => n.id === nodeId) || data.nodes[0];
  if (!selected)
    return (
      <Panel>
        <EmptyState
          title="No nodes available"
          description="Load the node list from your gateway, then configure each attached media source."
          action={
            <a className="button primary" href="#settings">
              Connection settings
            </a>
          }
        />
      </Panel>
    );
  return (
    <div className="node-media">
      <div className="section-toolbar">
        <label>
          Watch node{" "}
          <select
            aria-label="Media node"
            value={selected.id}
            onChange={(e) => {
              window.location.hash = `node-media/${encodeURIComponent(e.target.value)}`;
            }}
          >
            {data.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.id} · {n.location.label}
              </option>
            ))}
          </select>
        </label>
        <span className="muted">
          {settings.mode === "demo"
            ? "DEMO · synthetic media and sensor readings"
            : "LIVE · sources connect independently"}
        </span>
        <a className="text-link" href={`#overview/${selected.id}`}>
          Overview ↗
        </a>
      </div>
      <NodeConsole
        key={`${settings.mode}-${selected.id}`}
        nodeId={selected.id}
      />
    </div>
  );
}
