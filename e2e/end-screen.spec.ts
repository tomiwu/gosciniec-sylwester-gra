import { expect, test, type Page } from "@playwright/test";

// Fake Supabase answers, so the shots do not write to the live database.
// With no Supabase env, the app uses the local mock and these routes are not used.
const BOARD = [
  { nickname: "Kasia_Bal", score: 420 },
  { nickname: "Marek77", score: 395 },
  { nickname: "Ola", score: 360 },
  { nickname: "Tango<3", score: 330 },
  { nickname: "Ada", score: 240 },
  { nickname: "Wiktor", score: 210 },
  { nickname: "Zosia", score: 180 },
  { nickname: "Piotr", score: 150 },
];

async function fakeSupabase(page: Page, progress: number): Promise<void> {
  await page.route("**/rest/v1/rpc/**", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop();
    const answers: Record<string, unknown> = {
      issue_code: {
        accepted: true,
        code: "SYL-7K2P",
        discount_percent: progress >= 5 ? 20 : 10,
        referral_progress: progress,
        referral_needed: 5,
      },
      leaderboard: BOARD,
      referral_status: {
        token: "NZ6ETKB5FA",
        referral_progress: progress,
        referral_needed: 5,
        discount_percent: progress >= 5 ? 20 : 10,
      },
      record_referral_finish: false,
    };
    await route.fulfill({ json: answers[name ?? ""] ?? null });
  });
}

test("end screen: call, referral share and top list", async ({
  page,
}, info) => {
  await fakeSupabase(page, 2);
  await page.goto("/?shot=end&nick=Ada");
  await page.locator("[data-screen=end]").waitFor();
  const call = page.locator("#call");
  await expect(call).toHaveAttribute("href", "tel:+48632888628");
  await expect(call).toContainText("Zadzwoń i zarezerwuj");
  await expect(page.locator("#book")).toBeVisible();
  await expect(page.locator("#share")).toBeVisible();
  await expect(page.locator("#refer")).toContainText("/5");
  await expect(page.locator("#board li.me")).toContainText("Ada");
  await page.screenshot({
    path: `docs/gallery/${info.project.name}-end.png`,
    fullPage: true,
  });
});

test("end screen: copy fallback when Web Share is missing", async ({
  page,
  context,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Clipboard grant is Chromium only.",
  );
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await fakeSupabase(page, 5);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined });
  });
  await page.goto("/?shot=end&nick=Ada");
  await page.locator("#share").click();
  await expect(page.locator("#share-msg")).toContainText("skopiowany");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/\?ref=[2-9A-HJ-NP-Z]{10}$/);
  await page.screenshot({
    path: `docs/gallery/${info.project.name}-end-bonus.png`,
    fullPage: true,
  });
});
