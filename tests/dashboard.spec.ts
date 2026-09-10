import { test, expect } from "@playwright/test";
import { defaultSettings } from "../src/config/dashboard";
test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ request }) => {
  const response = await request.put("/api/settings", {
    data: defaultSettings,
  });
  expect(response.ok()).toBeTruthy();
});
test("all workspace pages work without browser exceptions", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "LoRaMesh topology" }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page.screenshot({
    path: "test-results/overview-desktop.png",
    fullPage: true,
  });
  for (const [view, title] of [
    ["live-monitoring", "Live Monitoring"],
    ["nodes", "Nodes"],
    ["network", "LoRaMesh Network"],
    ["gateway", "Gateway"],
    ["sensors", "Sensors"],
    ["analytics", "Analytics"],
    ["alerts", "Alerts"],
    ["map", "Map & Locations"],
    ["intelligence", "AI / Intelligence"],
    ["device-control", "Device Control"],
    ["data-logs", "Data Logs"],
    ["reports", "Reports"],
    ["system-health", "System Health"],
    ["settings", "Settings"],
  ]) {
    await page.locator(`nav a[href="#${view}"]`).click();
    await expect(page.locator("h1")).toHaveText(title);
    await expect(page.locator("main .panel").first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test("node detail and topology inspection are interactive", async ({
  page,
}) => {
  await page.goto("/#nodes");
  await page.locator("a.device-cell").first().click();
  await expect(page.locator("h1")).toHaveText("NODE-01");
  await expect(page.getByText("Firmware", { exact: true })).toBeVisible();
  await expect(page.locator('svg[aria-label$="history chart"]')).toHaveCount(7);
  await page.locator('nav a[href="#network"]').click();
  await page.getByRole("button", { name: "Inspect NODE-02" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("link", { name: "View device details" }).click();
  await expect(page.locator("h1")).toHaveText("NODE-02");
});
test("alert actions persist to PostgreSQL", async ({ page, request }) => {
  await page.goto("/#alerts");
  await expect(page.locator(".full-alert").first()).toBeVisible();
  const action = page
    .getByRole("button", { name: "Acknowledge", exact: true })
    .first();
  if (await action.isVisible()) await action.click();
  await expect(
    page
      .locator(".full-alert-copy small")
      .filter({ hasText: "acknowledged" })
      .first(),
  ).toBeVisible();
  const response = await request.get("/api/alerts");
  const actions = await response.json();
  expect(
    actions.some((a: { state: string }) => a.state === "acknowledged"),
  ).toBeTruthy();
  await page.reload();
  await expect(
    page
      .locator(".full-alert-copy small")
      .filter({ hasText: "acknowledged" })
      .first(),
  ).toBeVisible();
});
test("device commands are explicitly simulated and saved", async ({
  page,
  request,
}) => {
  await page.goto("/#device-control");
  await page
    .getByRole("button", { name: "Simulate command", exact: true })
    .click();
  await expect(
    page
      .locator(".command-history")
      .getByText(/No hardware command was sent/)
      .first(),
  ).toBeVisible();
  const response = await request.get("/api/commands");
  const commands = await response.json();
  expect(commands[0].status).toBe("simulated");
});
test("reports generate, persist, and export", async ({ page }) => {
  await page.goto("/#reports");
  await page.getByRole("button", { name: "Generate report" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("DEMO REPORT")).toBeVisible();
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export complete report" }).click();
  const download = await event;
  expect(download.suggestedFilename()).toMatch(/vandoot-report.*csv/);
});
test("analytics filtering and log export work", async ({ page }) => {
  await page.goto("/#analytics");
  await page
    .getByRole("combobox", { name: "Sensor", exact: true })
    .selectOption("humidity");
  await expect(
    page.getByRole("heading", { name: "Humidity analysis" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "7 days", exact: true }).click();
  await page.locator('nav a[href="#data-logs"]').click();
  await page.getByLabel("Log node").selectOption("NODE-02");
  await expect(page.locator("tbody tr").first()).toContainText("NODE-02");
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  expect((await event).suggestedFilename()).toContain("vandoot-logs-demo");
});
test("live mode never substitutes demo hardware", async ({ page, request }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "LoRaMesh topology" }),
  ).toBeVisible();
  await page
    .locator(".mode-switch")
    .getByRole("button", { name: "Live", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Waiting for your gateway" }),
  ).toBeVisible();
  await expect(page.locator(".connection-banner")).toContainText(
    "No simulated hardware data",
  );
  await expect(page.locator("a.device-cell")).toHaveCount(0);
  await request.put("/api/settings", { data: defaultSettings });
});
test("settings persist and demo telemetry updates dynamically", async ({
  page,
}) => {
  await page.goto("/#settings");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await page.getByRole("spinbutton", { name: /Refresh interval/ }).fill("2");
  await page
    .getByRole("combobox", { name: /Temperature display/ })
    .selectOption("imperial");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(
    page.getByRole("spinbutton", { name: /Refresh interval/ }),
  ).toHaveValue("2");
  await page.locator('nav a[href="#overview"]').click();
  await expect(page.locator(".sensor-value").first()).toContainText("°F");
  const packets = page.locator(".kpi-value").nth(3);
  const initial = Number((await packets.innerText()).replace(/\D/g, ""));
  await expect
    .poll(async () => Number((await packets.innerText()).replace(/\D/g, "")), {
      timeout: 7000,
    })
    .toBeGreaterThan(initial);
});
test("mobile layout and sidebar stay within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "LoRaMesh topology" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.locator('nav a[href="#nodes"]').click();
  await expect(page.locator("h1")).toHaveText("Nodes");
  await expect(page.locator(".sidebar")).not.toHaveClass(/open/);
  await expect(page.locator(".sidebar")).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, -230, 0)",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/nodes-mobile.png",
    fullPage: true,
  });
});
