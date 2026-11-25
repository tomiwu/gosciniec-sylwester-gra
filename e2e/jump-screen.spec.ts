import { expect, test } from "@playwright/test";

test("jump start screen is a clean New Year Eve offer", async ({
  page,
}, info) => {
  await page.goto("/jump.html");
  const panel = page.locator("[data-screen=start]");
  await expect(panel).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sylwester");
  await expect(page.getByText("Wieża")).toBeVisible();
  await expect(page.getByRole("link", { name: "Zarezerwuj" })).toBeVisible();
  await expect(page.getByText("370 zł / os.", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Gościniec Uniejów" }),
  ).toBeVisible();
  const bodyText = await page.locator("body").innerText();
  expect(bodyText.toLowerCase()).not.toContain("black friday");
  expect(bodyText).not.toContain("599");
  await page.screenshot({
    path: `docs/gallery/${info.project.name}-jump-start.png`,
    fullPage: true,
  });
});

test("jump play and end screens load at phone size", async ({ page }, info) => {
  await page.goto("/jump.html?shot=play");
  await expect(page.locator("[data-screen=play]")).toBeVisible();
  await expect(page.getByRole("button", { name: "Skok" })).toBeVisible();
  await page.screenshot({
    path: `docs/gallery/${info.project.name}-jump-play.png`,
    fullPage: true,
  });
  await page.goto("/jump.html?shot=end&nick=Anna");
  await expect(page.locator("[data-screen=end]")).toBeVisible();
  await expect(page.getByText("Północ!")).toBeVisible();
  await expect(page.getByText("370 zł / os.")).toBeVisible();
  await expect(page.getByText("333 zł / os.")).toBeVisible();
  await expect(page.getByText("299 zł / os.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Zarezerwuj" })).toBeVisible();
  await expect(page.getByText("SYL-ANNA")).toBeVisible();
  await page.waitForTimeout(450);
  await page.screenshot({
    path: `docs/gallery/${info.project.name}-jump-end.png`,
    fullPage: true,
  });
});
