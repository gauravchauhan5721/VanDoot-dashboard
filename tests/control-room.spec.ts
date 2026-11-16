import { test, expect } from "@playwright/test";
import { defaultSettings } from "../src/config/dashboard";

test.beforeEach(async ({ request }) => {
  expect(
    (await request.put("/api/settings", { data: defaultSettings })).ok(),
  ).toBeTruthy();
});

for (const width of [360, 768, 1440]) {
  for (const theme of ["dark", "light"] as const) {
    test(`Overview ${width}px ${theme}: map, chart and evidence`, async ({
      page,
      request,
    }) => {
      await request.put("/api/settings", {
        data: { ...defaultSettings, theme },
      });
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/");
      await expect(
        page.getByRole("heading", { name: "Eyes on the forest." }),
      ).toBeVisible();
      await expect(page.getByLabel("Overview node")).toHaveValue("NODE-02");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      if (width === 360) {
        const alert = await page.locator(".priority-panel").boundingBox();
        const camera = await page.locator(".watch-camera").boundingBox();
        expect(alert!.y + alert!.height).toBeLessThanOrEqual(camera!.y);
      }
      await page.screenshot({
        path: `test-results/overview-${width}-${theme}.png`,
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Watch NODE-01", exact: true })
        .click();
      await expect(page.getByLabel("Overview node")).toHaveValue("NODE-01");
      await expect(page.locator(".camera-topline")).toContainText("NODE-01");
      await page
        .getByRole("slider", { name: "temperature sample", exact: true })
        .press("End");
      await expect(page.locator(".chart-readout")).toContainText("°C");
      await page.locator(".priority-alert").first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.locator(".evidence-content")).toContainText("NODE-02");
      await expect(page.locator(".evidence-content")).toContainText(
        "Not reported",
      );
      await expect(page.locator(".evidence-image img")).toBeVisible();
      await page.goBack();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByLabel("Overview node")).toHaveValue("NODE-01");
    });
  }
}

test("alert filters survive evidence, live-now and browser Back; keyboard search works", async ({
  page,
}) => {
  await page.goto("/#alerts?severity=critical&state=active&q=fire");
  await expect(page.locator(".full-alert")).toHaveCount(1);
  await page.locator(".alert-title").first().press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("link", { name: "View live now", exact: true }).click();
  await expect(page.getByLabel("Media node")).toHaveValue("NODE-02");
  await page.goBack();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Alert severity")).toHaveValue("critical");
  await expect(page.getByLabel("Search alerts")).toHaveValue("fire");
  await page.keyboard.press("Control+k");
  const search = page.getByRole("textbox", { name: "Search dashboard" });
  await expect(search).toBeFocused();
  await search.fill("NODE-03");
  await search.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.locator("h1")).toHaveText("NODE-03");
});

test("live fixtures: independent sources, evidence identity, stale readings and reconnect", async ({
  page,
  request,
}) => {
  await request.put("/api/settings", {
    data: {
      ...defaultSettings,
      mode: "live",
      apiEndpoint: "http://gateway.fixture",
      wsEndpoint: "",
      refreshInterval: 2,
    },
  });
  await page.clock.install();
  let connected = true;
  let stale = false;
  let modelConnected = true;
  let events = true;
  const stamp = new Date().toISOString();
  await page.route("http://gateway.fixture/latest", async (route) => {
    const time = await page.evaluate(() => Date.now());
    if (!connected) return route.abort("failed");
    return route.fulfill({
      json: {
        "NODE-01": {
          online: true,
          received_at: new Date(time - (stale ? 31000 : 100)).toISOString(),
          temperature: 29.2,
          humidity: 58,
          location: { lat: 31, lng: 76, label: "Fixture ranger post" },
        },
        "NODE-02": {
          online: true,
          received_at: new Date(time - 100).toISOString(),
          PIR: 0,
        },
      },
    });
  });
  await page.route("http://gateway.fixture/thermal", (route) =>
    route.fulfill({
      json: {
        nodeId: "NODE-01",
        width: 32,
        height: 24,
        timestamp: new Date(Date.now() - 1000).toISOString(),
        values: Array(768).fill(28.5),
      },
    }),
  );
  await page.route("http://gateway.fixture/events", (route) =>
    route.fulfill({
      json: {
        modelStatus: modelConnected ? "connected" : "disconnected",
        events: events
          ? [
              {
                nodeId: "NODE-01",
                id: "capture-1",
                timestamp: stamp,
                type: "camera",
                label: "Fixture smoke",
                model: "fixture-only",
                version: "v1",
                score: 0.82,
                imageUrl: "http://gateway.fixture/capture.jpg",
                frameId: "one",
                evidenceFrameId: "different",
                box: [0.1, 0.1, 0.2, 0.2],
              },
            ]
          : [],
      },
    }),
  );
  await page.route("http://gateway.fixture/capture.jpg", (route) =>
    route.fulfill({
      path: "public/demo/camera-poster.jpg",
      contentType: "image/jpeg",
    }),
  );
  await page.route("http://gateway.fixture/camera", (route) =>
    route.abort("failed"),
  );
  await page.addInitScript(
    () =>
      !localStorage.getItem("vandoot-media-live") &&
      localStorage.setItem(
        "vandoot-media-live",
        JSON.stringify({
          "NODE-01": {
            camera: "http://gateway.fixture/camera",
            thermal: "http://gateway.fixture/thermal",
            events: "http://gateway.fixture/events",
            audio: "",
            image: "",
          },
        }),
      ),
  );
  await page.goto("/#node-media/NODE-01");
  await expect(
    page.getByText("Camera unavailable or blocked", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".thermal-view output")).toContainText("28.5 °C");
  await expect(page.locator(".event-row")).toContainText("Fixture smoke");
  await expect(page.locator(".node-readings")).toContainText("Not reported");
  await page.locator(".event-row").click();
  await expect(page.locator(".evidence-content")).toContainText("82.0%");
  await expect(page.locator(".evidence-content")).toContainText(stamp);
  await expect(page.locator(".evidence-box")).toHaveCount(0);
  await expect(page.locator(".evidence-image img")).toBeVisible();
  await page.goBack();
  stale = true;
  await page.clock.fastForward(31_001);
  await expect(page.locator(".node-readings")).toContainText(
    "Stale / unknown",
    { timeout: 7000 },
  );
  await expect(page.locator(".reading strong").first()).toContainText("—");
  connected = false;
  await expect(page.locator(".connection-banner")).toBeVisible({
    timeout: 7000,
  });
  connected = true;
  stale = false;
  await expect(page.locator(".reading strong").first()).toContainText("29.2", {
    timeout: 7000,
  });
  await page.getByLabel("Media node").selectOption("NODE-02");
  await expect(page).toHaveURL(/#node-media\/NODE-02$/);
  await expect(page.getByLabel("Media node")).toHaveValue("NODE-02");
  await expect(page.locator(".thermal-view")).toHaveCount(0);
  await expect(
    page.getByText("No detections received.", { exact: true }),
  ).toBeVisible();
  modelConnected = false;
  events = false;
  await page.getByLabel("Media node").selectOption("NODE-01");
  await expect(
    page.getByText("Model disconnected", { exact: true }),
  ).toBeVisible({ timeout: 6000 });
  await page.getByRole("button", { name: "Configure node sources" }).click();
  await expect(page.getByLabel("ESP32-CAM MJPEG URL")).toHaveValue(
    "http://gateway.fixture/camera",
  );
  await page.getByRole("button", { name: "Test thermal", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Source responded");
  await page
    .getByLabel("Latest detection image URL")
    .fill("http://gateway.fixture/capture.jpg");
  await page.getByRole("button", { name: "Save sources", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Configure node sources" }).click();
  await expect(page.getByLabel("Latest detection image URL")).toHaveValue(
    "http://gateway.fixture/capture.jpg",
  );
  await expect(page.getByLabel("MLX90640 thermal JSON URL")).toHaveValue(
    "http://gateway.fixture/thermal",
  );
});

test("incident access control and reviewer actions retain captured context", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/forest")).status()).toBe(401);
  const token = process.env.FOREST_ADMIN_TOKEN;
  test.skip(
    !token,
    "Set FOREST_ADMIN_TOKEN on the test server and test runner to verify authorized review writes.",
  );
  await page.goto("/#alerts/demo-evidence");
  await page
    .getByRole("link", { name: "Open incident review", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save incident", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Workspace access token").fill(token!);
  await page
    .getByRole("button", { name: "Save incident", exact: true })
    .click();
  await expect(
    page.getByText("Saved to PostgreSQL.", { exact: true }),
  ).toBeVisible();
  const record = page.locator(".forest-record").first();
  await record
    .getByLabel("Review note")
    .fill("Reviewed synthetic test fixture");
  for (const state of ["acknowledged", "resolved", "false-positive"]) {
    await record.getByRole("button", { name: state, exact: true }).click();
    await expect(record.locator(".forest-chip")).toHaveText(state);
  }
  const response = await request.get("/api/forest", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const records = await response.json();
  const saved = records.find(
    (r: { payload: { alertId?: string } }) =>
      r.payload.alertId === "demo-evidence",
  );
  expect(saved.payload.capturedEvidence.simulated).toBe(true);
  expect(saved.payload.nearbyReadings.length).toBeGreaterThan(0);
  expect(saved.payload.reviews).toHaveLength(3);
});
