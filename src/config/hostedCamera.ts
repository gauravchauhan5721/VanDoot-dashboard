const dashboardHost = "van-doot-dashboard-c873.vercel.app";
const gateway = "https://vandoot-gateway.tail0dfecc.ts.net";

export function hostedCamera() {
  if (
    typeof window === "undefined" ||
    window.location.hostname !== dashboardHost
  )
    return;
  const media = `${gateway}:8443`;
  return {
    nodeId: "VANDOOT_NODE_3",
    gateway,
    camera: `${media}/latest.jpg`,
    events: `${media}/events`,
    oldStream: `${media}/stream`,
  };
}
