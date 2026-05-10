import { expect, test } from "@playwright/test";

test("homepage renders without backend auth dependencies", async ({ page }) => {
  await page.route("**/api/v1/auth/refresh", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "UNAUTHORIZED",
          message: "Unauthorized",
        },
      }),
    });
  });

  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "A home page system that looks like it belongs with your auth flow.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "Home" })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "Browse" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in" }).first()).toBeVisible();
});
