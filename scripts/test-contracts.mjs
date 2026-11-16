import ts from "typescript";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
const modules = new Map();
function moduleURL(path) {
  path = resolve(path);
  if (modules.has(path)) return modules.get(path);
  let code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  code = code.replace(
    /(from\s*["'])([^"']+)(["'])/g,
    (match, before, specifier, after) => {
      if (!specifier.startsWith("@/") && !specifier.startsWith("."))
        return match;
      const target = specifier.startsWith("@/")
        ? resolve("src", specifier.slice(2))
        : resolve(dirname(path), specifier);
      return before + moduleURL(target + ".ts") + after;
    },
  );
  const url =
    "data:text/javascript;base64," + Buffer.from(code).toString("base64");
  modules.set(path, url);
  return url;
}
async function load(path) {
  return import(moduleURL(path));
}
const { normalizeLatest } = await load("src/services/LiveApiService.ts");
const now = Date.parse("2026-11-14T12:00:00Z");
let s = normalizeLatest(
  {
    one: {
      online: true,
      received_at: new Date(now).toISOString(),
      temperature: 25,
      mq2: 180,
      PIR: 1,
    },
  },
  now,
);
assert.equal(s.nodes[0].status, "online");
assert.equal(s.nodes[0].readings.MQ2, 180);
assert.ok(Number.isNaN(s.nodes[0].readings.battery));
assert.ok(Number.isNaN(s.nodes[0].location.lat));
assert.equal(s.gateways.length, 0);
s = normalizeLatest(
  {
    one: {
      online: true,
      received_at: new Date(now - 31000).toISOString(),
      temperature: 25,
    },
  },
  now,
);
assert.equal(s.nodes[0].status, "offline");
assert.equal(s.history.length, 0);
s = normalizeLatest({ one: { online: true, temperature: 25 } }, now);
assert.equal(s.nodes[0].status, "offline");
assert.equal(s.nodes[0].lastSeen, "");
s = normalizeLatest({ one: { received_at: new Date(now).toISOString() } }, now);
assert.equal(s.nodes[0].status, "offline");
assert.throws(() => normalizeLatest([], now));
const { thermalFrame, validateInference } = await load(
  "src/features/forest/contracts.ts",
);
assert.equal(thermalFrame(Array(768).fill(25)).length, 768);
assert.throws(() => thermalFrame(Array(767).fill(25)));
assert.throws(() => thermalFrame(Array(768).fill(null)));
assert.ok(
  validateInference({
    model: "test",
    version: "v1",
    detections: [{ label: "smoke", confidence: 0.8, box: [0, 0.1, 0.5, 0.5] }],
  }),
);
assert.ok(
  !validateInference({
    model: "test",
    version: "v1",
    detections: [{ label: "smoke", confidence: 1.2 }],
  }),
);
assert.ok(
  !validateInference({
    model: "test",
    version: "v1",
    detections: [{ label: "smoke", confidence: 0.8, box: [0, 0, -1, 1] }],
  }),
);
console.log(
  "Passed: telemetry freshness, unknown values, aliases, location, malformed payload, thermal frames and model response validation.",
);

const { parseThermal, parseEvents, matchingBox, safeMediaURL, eventAlert } =
  await load("src/features/media/contracts.ts");
const { isFresh, nearbyReadings, thresholdAlerts } = await load(
  "src/utils/telemetry.ts",
);
const { defaultSettings } = await load("src/config/dashboard.ts");
assert.ok(isFresh(new Date(now - 30000).toISOString(), now));
assert.ok(!isFresh(new Date(now - 30001).toISOString(), now));
assert.ok(!isFresh(new Date(now + 1).toISOString(), now));
assert.ok(!isFresh("", now));
const frame = {
  nodeId: "one",
  width: 32,
  height: 24,
  timestamp: new Date(now).toISOString(),
  values: Array(768).fill(26),
};
assert.equal(parseThermal(frame, "one").values.length, 768);
assert.throws(() => parseThermal(frame, "two"));
assert.throws(() => parseThermal({ ...frame, width: 24 }, "one"));
const event = {
  id: "e1",
  nodeId: "one",
  type: "camera",
  label: "Smoke",
  timestamp: frame.timestamp,
  score: 0.8,
  model: "forest",
  version: "v1",
  imageUrl: "http://gateway.local/capture-1.jpg",
  frameId: "f1",
  evidenceFrameId: "f1",
  box: [0.1, 0.1, 0.3, 0.4],
};
const parsed = parseEvents(
  {
    events: [event, { ...event, nodeId: "other" }, { ...event, score: 2 }],
    modelStatus: "disconnected",
  },
  "one",
);
assert.equal(parsed.events.length, 1);
assert.equal(parsed.modelStatus, "disconnected");
assert.deepEqual(matchingBox(parsed.events[0]), event.box);
assert.equal(
  matchingBox({ ...event, evidenceFrameId: "different" }),
  undefined,
);
assert.equal(
  parseEvents(
    [{ ...event, box: [0.9, 0, 0.8, 1], model: { bad: true } }],
    "one",
  ).events[0].box,
  undefined,
);
assert.equal(
  parseEvents([{ ...event, model: { bad: true } }], "one").events[0].model,
  undefined,
);
assert.equal(
  eventAlert({ ...event, type: "sound-level" }).message.includes(
    "Classification not reported",
  ),
  true,
);
assert.throws(() => safeMediaURL("https://user:secret@gateway.local"));
assert.throws(() => safeMediaURL("https://gateway.local?api_key=secret"));
assert.throws(() => safeMediaURL("javascript:alert(1)"));
assert.equal(
  safeMediaURL("/demo/camera-poster.jpg", true),
  "/demo/camera-poster.jpg",
);
const nearby = nearbyReadings(
  [
    {
      nodeId: "one",
      timestamp: frame.timestamp,
      readings: { temperature: 27 },
    },
    { nodeId: "other", timestamp: frame.timestamp, readings: { humidity: 90 } },
    {
      nodeId: "one",
      timestamp: new Date(now - 31000).toISOString(),
      readings: { humidity: 88 },
    },
  ],
  "one",
  frame.timestamp,
);
assert.deepEqual(nearby, [
  { sensor: "temperature", value: 27, timestamp: frame.timestamp },
]);
const cross = new Map();
const make = (value) =>
  normalizeLatest(
    { one: { online: true, received_at: frame.timestamp, temperature: value } },
    now,
  );
assert.equal(thresholdAlerts(make(60), defaultSettings, cross, now).length, 1);
assert.equal(thresholdAlerts(make(60), defaultSettings, cross, now).length, 0);
thresholdAlerts(make(20), defaultSettings, cross, now);
assert.equal(thresholdAlerts(make(60), defaultSettings, cross, now).length, 1);
assert.equal(
  thresholdAlerts(make(60), defaultSettings, new Map(), now + 31000).length,
  0,
);
console.log(
  "Passed: 30-second boundary, future timestamps, exact media node/frame matching, model metadata sanitization, secret-free sources, nearby timestamps, threshold crossing/rearm.",
);

const { sensorById } = await load("src/config/sensors.ts");
assert.equal(sensorById.pm25.unit, "\u00b5g/m\u00b3");
assert.equal(sensorById.thermalMax.unit, "\u00b0C");
const { normalizeSocketPayload } = await load(
  "src/services/WebSocketService.ts",
);
assert.equal(
  normalizeSocketPayload(
    { one: { online: true, received_at: frame.timestamp, temperature: 26 } },
    now,
  ).nodes[0].status,
  "online",
);
assert.equal(
  normalizeSocketPayload(
    {
      ...make(26),
      alerts: [
        {
          id: "alert-1",
          nodeId: "one",
          title: "Reported event",
          message: "Review",
          timestamp: frame.timestamp,
          severity: "warning",
          state: "active",
          evidence: event,
        },
      ],
    },
    now,
  ).alerts[0].evidence.model,
  "forest",
);
assert.throws(() => normalizeSocketPayload({ nodes: "invalid" }, now));
console.log(
  "Passed: canonical sensor units and WebSocket dictionary/full-snapshot contracts.",
);
