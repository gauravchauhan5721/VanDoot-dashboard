/**
 * Shared illustrative topology for the simulation, 3D forest and network map.
 * These links and chosen routes are a teaching model, not a measured deployment
 * or a claim about an actual painlessMesh routing table or radio coverage.
 */
export const MESH_EDGES = Object.freeze([
  { id: 'mesh-n1-root', from: 'n1', to: 'mesh-root' },
  { id: 'mesh-n1-n2', from: 'n1', to: 'n2' },
  { id: 'mesh-n2-n3', from: 'n2', to: 'n3' },
  { id: 'mesh-n1-n3', from: 'n1', to: 'n3' },
  { id: 'mesh-n1-n4', from: 'n1', to: 'n4' },
  { id: 'mesh-n4-n7', from: 'n4', to: 'n7' },
  { id: 'mesh-n1-n7', from: 'n1', to: 'n7' },
  { id: 'mesh-n5-n7', from: 'n5', to: 'n7' },
  { id: 'mesh-n5-n6', from: 'n5', to: 'n6' },
  { id: 'mesh-n3-n6', from: 'n3', to: 'n6' },
  { id: 'mesh-n5-root', from: 'n5', to: 'mesh-root' },
].map(edge => Object.freeze(edge)));

const ROUTES = {
  n1: ['n1', 'mesh-root'],
  n2: ['n2', 'n1', 'mesh-root'],
  n3: ['n3', 'n2', 'n1', 'mesh-root'],
  n4: ['n4', 'n1', 'mesh-root'],
  n5: ['n5', 'mesh-root'],
  n6: ['n6', 'n3', 'n2', 'n1', 'mesh-root'],
  n7: ['n7', 'n4', 'n1', 'mesh-root'],
};
const edgeKey = (from, to) => [from, to].sort().join(':');

/** Chosen route remains visible even if its link is unavailable. */
export function getMeshRoute(state, nodeId) {
  if (!state.nodes.some(node => node.id === nodeId)) return [];
  if (state.routeMode === 'lora') return [nodeId, 'mesh-root'];
  if (state.phase === 'proposed' && state.routeMode === 'rerouting') {
    if (nodeId === 'n3') return ['n3', 'n1', 'mesh-root'];
    if (nodeId === 'n6') return ['n6', 'n3', 'n1', 'mesh-root'];
  }
  return [...(ROUTES[nodeId] ?? [])];
}

/** Active means selected by a route; standby means available but unselected. */
export function getMeshLinks(state) {
  const nodes = new Map(state.nodes.map(node => [node.id, node]));
  const present = id => id === 'mesh-root' || nodes.has(id);
  const wifiAvailable = state.routeMode !== 'offline' && state.routeMode !== 'lora';
  const usable = id => id === 'mesh-root' ? state.gatewayOnline : nodes.get(id)?.online && nodes.get(id)?.link === 'wifi';
  const used = new Set();
  if (wifiAvailable) {
    for (const node of state.nodes) {
      const route = getMeshRoute(state, node.id);
      for (let index = 0; index < route.length - 1; index++) used.add(edgeKey(route[index], route[index + 1]));
    }
  }
  return MESH_EDGES.filter(edge => present(edge.from) && present(edge.to)).map(edge => ({
    ...edge,
    status: !wifiAvailable || !usable(edge.from) || !usable(edge.to) ? 'offline' : used.has(edgeKey(edge.from, edge.to)) ? 'active' : 'standby',
  }));
}

/** One shared interpretation of packet progress keeps every view on one hop. */
export function getPacketMeshHop(packet) {
  if (!packet || packet.stage !== 2 || !Array.isArray(packet.path)) return null;
  const rootIndex = packet.path.indexOf('mesh-root');
  if (rootIndex < 1) return null;
  const count = rootIndex;
  const progress = Math.max(0, Math.min(1, Number.isFinite(packet.progress) ? packet.progress : 0));
  const scaled = progress * count;
  const index = Math.min(count - 1, Math.floor(scaled));
  return { from: packet.path[index], to: packet.path[index + 1], progress: progress === 1 ? 1 : scaled - index, index, count };
}
