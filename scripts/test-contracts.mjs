import ts from "typescript";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
async function load(path) {
  let code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  code = code.replace(
    /import \{ apiConfig \} from ['"]@\/config\/api['"];?/,
    "const apiConfig={timeout:8000};",
  );
  return import(
    "data:text/javascript;base64," + Buffer.from(code).toString("base64")
  );
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
