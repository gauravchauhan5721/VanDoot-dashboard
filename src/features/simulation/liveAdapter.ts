import type { Snapshot, SensorNode } from "@/types";

/**
 * Configure explicit hardware-to-3D mappings when devices are installed.
 * Keys are the simulation IDs (n1, n2...), values are SensorNode.id
 * as returned by the existing VanDoot live API.
 */
export const liveNodeMap: Record<string, string> = {
  n1: "NODE-01",
  n2: "NODE-02",
  n3: "NODE-03",
};

type ForestNode = {
  id: string;
  temp: number;
  humidity: number;
  gas: number;
  online: boolean;
  link: string;
  [key: string]: unknown;
};
type ForestState = { nodes: ForestNode[]; [key: string]: unknown };

const MAX_AGE_MS = 30_000;

function readValue(
  readings: SensorNode["readings"],
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const value = readings[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

export function overlayLiveTelemetry<T extends ForestState>(
  simulation: T,
  snapshot: Snapshot,
  mapping: Record<string, string>,
  now: number = Date.now(),
): T {
  const byId = new Map(snapshot.nodes.map((n) => [n.id, n]));
  return {
    ...simulation,
    nodes: simulation.nodes.map((node) => {
      const id = mapping[node.id];
      const hardware = id ? byId.get(id) : undefined;
      const receivedAt = hardware ? Date.parse(hardware.lastSeen) : NaN;
      const fresh = Boolean(
        hardware &&
        hardware.status !== "offline" &&
        Number.isFinite(receivedAt) &&
        now - receivedAt >= 0 &&
        now - receivedAt <= MAX_AGE_MS,
      );
      if (!hardware || !fresh) {
        return {
          ...node,
          online: false,
          link: "offline",
          temp: NaN,
          humidity: NaN,
          gas: NaN,
        };
      }
      return {
        ...node,
        online: true,
        link: hardware.status === "weak" ? "weak" : "good",
        temp: readValue(hardware.readings, ["temperature", "temp"]) ?? NaN,
        humidity: readValue(hardware.readings, ["humidity"]) ?? NaN,
        gas:
          readValue(hardware.readings, ["MQ2", "gas", "mq2", "smoke"]) ?? NaN,
      };
    }),
  } as T;
}
