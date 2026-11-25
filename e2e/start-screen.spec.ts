import { expect, test, type Page } from "@playwright/test";

const GOLD = { r: 212, g: 175, b: 55 };
const DARK_MAX = 40;

function parseRgb(
  value: string,
): { r: number; g: number; b: number; a: number } | null {
  const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
  if (!m) return null;
  return {
    r: Number(m[1]),
    g: Number(m[2]),
    b: Number(m[3]),
    a: m[4] === undefined ? 1 : Number(m[4]),
  };
}

function contrastRatio(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): number {
  const lum = (c: { r: number; g: number; b: number }) => {
    const n = [c.r, c.g, c.b].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * n[0]! + 0.7152 * n[1]! + 0.0722 * n[2]!;
  };
  const l1 = lum(a);
  const l2 = lum(b);
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

async function solidBackground(
  page: Page,
  el: string,
): Promise<{ r: number; g: number; b: number }> {
  return page.$eval(el, (node) => {
    let current: HTMLElement | null = node as HTMLElement;
    while (current) {
      const color = getComputedStyle(current).backgroundColor;
      const m = color.match(
        /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/,
      );
      if (m) {
        const a = m[4] === undefined ? 1 : Number(m[4]);
        if (a >= 0.8) {
          return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
        }
      }
      current = current.parentElement;
    }
    return { r: 20, g: 15, b: 12 };
  });
}

test("start screen fits the viewport and keeps a gold-on-dark palette", async ({
  page,
}, info) => {
  await page.goto("/");
  const panel = page.locator("[data-screen=start]");
  await expect(panel).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sylwester");
  await expect(page.getByRole("link", { name: "Zarezerwuj" })).toBeVisible();

  const overflow = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - window.innerWidth,
    y: document.documentElement.scrollHeight - window.innerHeight,
  }));
  expect(
    overflow.x,
    "the layout must not overflow the viewport in x",
  ).toBeLessThanOrEqual(1);

  const boxes = await page
    .locator("h1, .price, .btn, a.btn")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = (node as HTMLElement).getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
      }),
    );
  const { innerWidth, innerHeight } = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  }));
  for (const box of boxes) {
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.right).toBeLessThanOrEqual(innerWidth + 1);
    expect(box.bottom).toBeLessThanOrEqual(innerHeight + 1);
  }

  const titleColor = parseRgb(
    await page.locator("h1").evaluate((el) => getComputedStyle(el).color),
  );
  const titleBg = await solidBackground(page, "h1");
  expect(titleColor).not.toBeNull();
  expect(contrastRatio(titleColor!, titleBg)).toBeGreaterThanOrEqual(4.5);

  await expect(
    page.getByRole("img", { name: "Gościniec Uniejów" }),
  ).toBeVisible();

  const gold = parseRgb(
    await page.locator(".year").evaluate((el) => getComputedStyle(el).color),
  );
  expect(gold).not.toBeNull();
  expect(Math.abs(gold!.r - GOLD.r)).toBeLessThan(30);
  expect(Math.abs(gold!.g - GOLD.g)).toBeLessThan(30);
  expect(Math.abs(gold!.b - GOLD.b)).toBeLessThan(40);
  expect(titleBg.r).toBeLessThan(DARK_MAX + 20);
  expect(titleBg.g).toBeLessThan(DARK_MAX + 10);
  expect(titleBg.b).toBeLessThan(DARK_MAX);

  await expect(page.getByText("370 zł / os.", { exact: true })).toBeVisible();
  const bodyText = await page.locator("body").innerText();
  expect(bodyText.toLowerCase()).not.toContain("black friday");
  expect(bodyText).not.toContain("599");
  expect(bodyText).not.toContain("740");

  await page.screenshot({
    path: `docs/gallery/${info.project.name}-start.png`,
    fullPage: true,
  });
});
