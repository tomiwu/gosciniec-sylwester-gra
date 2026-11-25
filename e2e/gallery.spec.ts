import { test } from "@playwright/test";

// The start-screen spec already writes docs/gallery/<project>-start.png.
// This file exists so `npm run gallery` has a stable entry. It repeats the shots.
test("write start-screen shots for review", async ({ page }, info) => {
  await page.goto("/");
  await page.locator("[data-screen=start]").waitFor();
  await page.screenshot({
    path: `docs/gallery/${info.project.name}-start.png`,
    fullPage: true,
  });
});
