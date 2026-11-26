import {
  expect,
  test as base,
  type Locator,
  type Page,
} from "@playwright/test";
import {
  AFTER_END,
  BEFORE_END,
  GUEST_USER,
  SEED_CODES,
  SEED_PLAYERS,
  STAFF_USER,
  blockNetwork,
  createFakeStaffApi,
  seedKodySession,
  type FakeStaffApi,
} from "./staff-fake";

/**
 * Staff panel flows at /panel/ against the production build.
 * The staff API is a fake on the same-origin routes, the Kody session is the
 * mock session, every other request is aborted, and all data is invented.
 */
const PANEL = "/panel/";
const ORIGIN = "http://127.0.0.1:4173";
const REDEEM = "/api/staff/redeem";
const HIDE = "/api/staff/hide-nickname";

type Fixtures = {
  now: Date;
  staff: FakeStaffApi;
  blocked: string[];
};

const test = base.extend<Fixtures>({
  now: [BEFORE_END, { option: true }],
  blocked: [
    async ({ context }, use) => {
      const blocked = await blockNetwork(context, ORIGIN);
      await use(blocked);
      expect(blocked, "the panel must not use the network").toEqual([]);
    },
    { auto: true },
  ],
  staff: [
    async ({ page, now }, use) => {
      await page.clock.setFixedTime(now);
      const staff = createFakeStaffApi({ now });
      await staff.install(page);
      await use(staff);
    },
    { auto: true },
  ],
});

test.describe.configure({ mode: "parallel" });

async function openAsStaff(page: Page): Promise<void> {
  await seedKodySession(page, STAFF_USER);
  await page.goto(PANEL);
  await expect(page.locator("[data-screen=shell]")).toBeVisible();
}

function nav(page: Page, name: string): Locator {
  return page.getByRole("navigation").getByRole("button", { name });
}

/** The value after a <dt> label in a definition list. */
function field(scope: Locator, label: string): Locator {
  return scope
    .locator("dt")
    .getByText(label, { exact: true })
    .locator("xpath=following-sibling::dd[1]");
}

async function checkCode(page: Page, code: string): Promise<Locator> {
  await page.getByLabel("Kod gracza").fill(code);
  await page.getByRole("button", { name: "Sprawdź", exact: true }).click();
  const result = page.locator(".code-result");
  await expect(field(result, "Kod")).toHaveText(code.trim().toUpperCase());
  return result;
}

/** The select's name also has the chosen option, so match inside the filter form. */
function statusFilter(page: Page): Locator {
  return page.locator("#code-list-filter").getByLabel("Status");
}

function redeemButton(page: Page): Locator {
  return page.getByRole("button", { name: "Oznacz jako wykorzystany" });
}

async function expectNoStaffData(page: Page): Promise<void> {
  await expect(page.locator("[data-screen=shell]")).toHaveCount(0);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(page.getByLabel("Kod gracza")).toHaveCount(0);
  await expect(page.locator("table, .code-result, .code-counts")).toHaveCount(
    0,
  );
  const text = await page.locator("body").innerText();
  for (const seed of SEED_CODES) {
    expect(text).not.toContain(seed.code);
    expect(text).not.toContain(seed.nickname);
  }
}

test.describe("sign in with Kody", () => {
  test("no session shows only the Kody sign-in button", async ({
    page,
    staff,
  }) => {
    await page.goto(PANEL);
    await expect(page.locator("[data-screen=login]")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Zaloguj się przez Kody" }),
    ).toBeVisible();
    await expect(page.locator("input[type=password]")).toHaveCount(0);
    await expect(page.locator("input[type=email]")).toHaveCount(0);
    await expect(page.locator("form")).toHaveCount(0);
    await expectNoStaffData(page);
    expect(staff.calls).toEqual([]);
  });

  test("the Kody button signs in a staff user to the panel shell", async ({
    page,
    staff,
  }) => {
    await page.goto(`${PANEL}?kodyUser=${STAFF_USER.username}`);
    await page.getByRole("button", { name: "Zaloguj się przez Kody" }).click();
    const shell = page.locator("[data-screen=shell]");
    await expect(shell).toBeVisible();
    await expect(shell.getByText("Zalogowano jako")).toContainText("tomiwu");
    for (const name of ["Sprawdź kod", "Lista kodów", "Ranking"]) {
      await expect(nav(page, name)).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Wyloguj" })).toBeVisible();
    await expect(page.getByLabel("Kod gracza")).toBeVisible();
    expect(staff.calls).toEqual([]);
  });

  test("a saved mock staff session reaches the shell after a reload", async ({
    page,
  }) => {
    await openAsStaff(page);
    await page.reload();
    await expect(page.locator("[data-screen=shell]")).toBeVisible();
    await expect(nav(page, "Sprawdź kod")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("a Kody user who is not on the allow-list sees Brak dostępu", async ({
    page,
    staff,
  }) => {
    await seedKodySession(page, GUEST_USER);
    await page.goto(PANEL);
    await expect(page.locator("[data-screen=denied]")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Brak dostępu" }),
    ).toBeVisible();
    await expect(page.getByText("guest-test")).toBeVisible();
    await expectNoStaffData(page);
    expect(staff.calls).toEqual([]);
  });

  test("the Kody button with a non-staff user also gives Brak dostępu", async ({
    page,
    staff,
  }) => {
    await page.goto(`${PANEL}?kodyUser=${GUEST_USER.username}`);
    await page.getByRole("button", { name: "Zaloguj się przez Kody" }).click();
    await expect(
      page.getByRole("heading", { name: "Brak dostępu" }),
    ).toBeVisible();
    await expectNoStaffData(page);
    expect(staff.calls).toEqual([]);
  });
});

test.describe("code check and redeem", () => {
  test("a valid 10 % code shows nick, 333 zł, date and Ważny", async ({
    page,
  }) => {
    await openAsStaff(page);
    const result = await checkCode(page, " syl-7k2p ");
    await expect(field(result, "Nick")).toHaveText("AdaTest");
    await expect(field(result, "Zniżka")).toHaveText("10% · 333 zł / os.");
    await expect(field(result, "Data uzyskania")).toHaveText(
      "20.11.2026, 19:30",
    );
    await expect(field(result, "Status")).toHaveText("Ważny");
    await expect(redeemButton(page)).toBeEnabled();
  });

  test("a valid share-bonus code shows 299 zł and Ważny", async ({ page }) => {
    await openAsStaff(page);
    const result = await checkCode(page, "SYL-9M4Q");
    await expect(field(result, "Nick")).toHaveText("BonusTest");
    await expect(field(result, "Zniżka")).toHaveText(
      "Bonus za polecenia · 299 zł / os.",
    );
    await expect(field(result, "Data uzyskania")).toHaveText(
      "22.11.2026, 11:15",
    );
    await expect(field(result, "Status")).toHaveText("Ważny");
    await expect(redeemButton(page)).toBeEnabled();
  });

  test("a valid code is redeemed exactly once", async ({ page, staff }) => {
    await openAsStaff(page);
    const result = await checkCode(page, "SYL-7K2P");
    await redeemButton(page).click();

    await expect(field(result, "Status")).toHaveText("Wykorzystany");
    await expect(page.getByRole("status")).toHaveText(
      "Kod oznaczono jako wykorzystany.",
    );
    await expect(redeemButton(page)).toBeDisabled();
    await redeemButton(page).click({ force: true });
    expect(staff.callsTo(REDEEM)).toEqual([
      { method: "POST", path: REDEEM, body: { code: "SYL-7K2P" } },
    ]);

    const again = await checkCode(page, "SYL-7K2P");
    await expect(field(again, "Status")).toHaveText("Wykorzystany");
    await expect(redeemButton(page)).toBeDisabled();
    expect(staff.callsTo(REDEEM)).toHaveLength(1);
  });

  test("a used code shows Wykorzystany and cannot be redeemed", async ({
    page,
    staff,
  }) => {
    await openAsStaff(page);
    const result = await checkCode(page, "SYL-USED");
    await expect(field(result, "Nick")).toHaveText("UsedTest");
    await expect(field(result, "Status")).toHaveText("Wykorzystany");
    await expect(redeemButton(page)).toBeDisabled();
    expect(staff.callsTo(REDEEM)).toEqual([]);
  });

  test("an unknown code shows Nieznany and cannot be redeemed", async ({
    page,
    staff,
  }) => {
    await openAsStaff(page);
    const result = await checkCode(page, "SYL-NONE");
    await expect(field(result, "Status")).toHaveText("Nieznany");
    await expect(field(result, "Nick")).toHaveText("—");
    await expect(field(result, "Zniżka")).toHaveText("—");
    await expect(redeemButton(page)).toBeDisabled();
    await redeemButton(page).click({ force: true });
    expect(staff.callsTo(REDEEM)).toEqual([]);
  });
});

test.describe("after the end of the promotion", () => {
  test.use({ now: AFTER_END });

  test("an expired code shows Wygasły and cannot be redeemed", async ({
    page,
    staff,
  }) => {
    await openAsStaff(page);
    const result = await checkCode(page, "SYL-OLD1");
    await expect(field(result, "Nick")).toHaveText("OldTest");
    await expect(field(result, "Status")).toHaveText("Wygasły");
    await expect(redeemButton(page)).toBeDisabled();
    await redeemButton(page).click({ force: true });
    expect(staff.callsTo(REDEEM)).toEqual([]);
  });

  test("the code list status filter finds the expired codes", async ({
    page,
  }) => {
    await openAsStaff(page);
    await nav(page, "Lista kodów").click();
    const rows = page.locator(".code-table tbody td.code-cell");
    await expect(rows).toHaveCount(SEED_CODES.length);
    await statusFilter(page).selectOption("Wygasły");
    await expect(rows).toHaveText(["SYL-9M4Q", "SYL-7K2P", "SYL-OLD1"]);
  });
});

test.describe("code list", () => {
  test("counts stay and the table reacts to status, kind and date filters", async ({
    page,
  }, info) => {
    await openAsStaff(page);
    await nav(page, "Lista kodów").click();

    const counts = page.locator(".code-counts");
    await expect(field(counts, "Gracze")).toHaveText(String(SEED_PLAYERS));
    await expect(field(counts, "Kody wydane")).toHaveText("4");
    await expect(field(counts, "Kody wykorzystane")).toHaveText("1");
    await expect(field(counts, "Polecenia")).toHaveText("8");

    const rows = page.locator(".code-table tbody td.code-cell");
    const shown = page.getByText(/^Pokazano:/);
    await expect(rows).toHaveText([
      "SYL-9M4Q",
      "SYL-7K2P",
      "SYL-USED",
      "SYL-OLD1",
    ]);
    await expect(shown).toHaveText("Pokazano: 4 / 4");

    const status = statusFilter(page);
    await status.selectOption("Wykorzystany");
    await expect(rows).toHaveText(["SYL-USED"]);
    await status.selectOption("Ważny");
    await expect(rows).toHaveText(["SYL-9M4Q", "SYL-7K2P", "SYL-OLD1"]);

    await page.getByLabel("Rodzaj zniżki").selectOption("Bonus (299 zł)");
    await expect(rows).toHaveText(["SYL-9M4Q"]);
    await page.getByLabel("Rodzaj zniżki").selectOption("10% (333 zł)");
    await expect(rows).toHaveText(["SYL-7K2P", "SYL-OLD1"]);

    await status.selectOption("Wszystkie");
    await page.getByLabel("Rodzaj zniżki").selectOption("Wszystkie");
    await page.getByLabel("Data uzyskania od").fill("2026-11-18");
    await expect(rows).toHaveText(["SYL-9M4Q", "SYL-7K2P", "SYL-USED"]);
    await page.getByLabel("Data uzyskania do").fill("2026-11-21");
    await expect(rows).toHaveText(["SYL-7K2P", "SYL-USED"]);
    await expect(shown).toHaveText("Pokazano: 2 / 4");

    await page.getByLabel("Data uzyskania od").fill("2026-11-23");
    await expect(rows).toHaveCount(0);
    await expect(
      page.getByText("Brak kodów dla wybranych filtrów."),
    ).toBeVisible();

    await expect(field(counts, "Gracze")).toHaveText(String(SEED_PLAYERS));
    await expect(field(counts, "Kody wydane")).toHaveText("4");
    await expect(field(counts, "Kody wykorzystane")).toHaveText("1");
    await expect(field(counts, "Polecenia")).toHaveText("8");

    await page.getByLabel("Data uzyskania od").fill("");
    await page.screenshot({
      path: `docs/gallery/${info.project.name}-panel-list.png`,
      fullPage: true,
    });
  });

  test("the counts include a code that was just redeemed", async ({ page }) => {
    await openAsStaff(page);
    await checkCode(page, "SYL-9M4Q");
    await redeemButton(page).click();
    await expect(redeemButton(page)).toBeDisabled();
    await nav(page, "Lista kodów").click();
    const counts = page.locator(".code-counts");
    await expect(field(counts, "Kody wykorzystane")).toHaveText("2");
    await statusFilter(page).selectOption("Wykorzystany");
    await expect(page.locator(".code-table tbody td.code-cell")).toHaveText([
      "SYL-9M4Q",
      "SYL-USED",
    ]);
  });
});

test.describe("ranking", () => {
  function rankingNicks(page: Page): Locator {
    return page.locator(".ranking-table tbody tr td:nth-child(2)");
  }

  test("Usuń nick hides the nick only after confirm", async ({
    page,
    staff,
  }) => {
    await openAsStaff(page);
    await nav(page, "Ranking").click();
    const nicks = rankingNicks(page);
    await expect(nicks).toHaveText([
      "BonusTest",
      "AdaTest",
      "UsedTest",
      "OldTest",
    ]);

    const adaRow = page.locator(".ranking-table tbody tr", {
      hasText: "AdaTest",
    });
    await adaRow.getByRole("button", { name: "Usuń nick" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("AdaTest");
    await dialog.getByRole("button", { name: "Anuluj" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(nicks).toContainText(["AdaTest"]);
    expect(staff.callsTo(HIDE)).toEqual([]);

    await adaRow.getByRole("button", { name: "Usuń nick" }).click();
    await dialog.getByRole("button", { name: "Ukryj" }).click();
    await expect(nicks).toHaveText(["BonusTest", "UsedTest", "OldTest"]);
    await expect(page.getByRole("status")).toContainText(
      "Nick ukryto w rankingu: AdaTest.",
    );
    expect(staff.callsTo(HIDE)).toEqual([
      { method: "POST", path: HIDE, body: { nickname: "AdaTest" } },
    ]);

    await page.getByRole("button", { name: "Odśwież" }).click();
    await expect(nicks).toHaveText(["BonusTest", "UsedTest", "OldTest"]);
  });

  test("a hidden nick keeps a working code", async ({ page }) => {
    await openAsStaff(page);
    await nav(page, "Ranking").click();
    await page
      .locator(".ranking-table tbody tr", { hasText: "AdaTest" })
      .getByRole("button", { name: "Usuń nick" })
      .click();
    await page.getByRole("button", { name: "Ukryj" }).click();
    await expect(rankingNicks(page)).not.toContainText(["AdaTest"]);

    await nav(page, "Sprawdź kod").click();
    const result = await checkCode(page, "SYL-7K2P");
    await expect(field(result, "Status")).toHaveText("Ważny");
    await expect(redeemButton(page)).toBeEnabled();
  });
});
