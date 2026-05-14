import { chromium } from "@playwright/test";

const url = process.env.URL ?? "http://localhost:3040/";
const outDir = process.env.OUT_DIR ?? ".playwright-mcp";

const viewports = [
  { name: "desktop-1440", width: 1440, height: 800 },
  { name: "desktop-1100", width: 1100, height: 800 },
  { name: "tablet-820",   width: 820,  height: 1180 },
  { name: "mobile-390",   width: 390,  height: 844 },
];

const browser = await chromium.launch();
try {
  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.route("**/api/v1/auth/refresh", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "UNAUTHORIZED", message: "Unauthorized" },
        }),
      }),
    );
    await page.goto(url, { waitUntil: "networkidle" });
    const path = `${outDir}/header-${vp.name}.png`;
    await page.screenshot({ path, clip: { x: 0, y: 0, width: vp.width, height: 160 } });
    console.log(`wrote ${path}`);

    // Mobile/tablet: also capture the expanded inline search
    if (vp.width < 1024) {
      await page.getByRole("button", { name: "Open search" }).click();
      await page.waitForTimeout(100);
      const expandedPath = `${outDir}/header-${vp.name}-search-open.png`;
      await page.screenshot({
        path: expandedPath,
        clip: { x: 0, y: 0, width: vp.width, height: 200 },
      });
      console.log(`wrote ${expandedPath}`);
    }

    await context.close();
  }
} finally {
  await browser.close();
}
