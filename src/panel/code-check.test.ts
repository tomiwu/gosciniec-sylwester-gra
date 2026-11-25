import { describe, expect, it } from "vitest";
import { STAFF } from "../config";
import { pl } from "../i18n/pl";
import {
  INITIAL_CODE_CHECK,
  canRedeem,
  createCodeCheck,
  discountLabel,
  earnedLabel,
  statusLabel,
  type CodeCheckState,
} from "./code-check";
import { MOCK_CODES, createMockStaffApi } from "./mock-staff-api";
import type { CodeCheck, StaffApi } from "./staff-api";

const BEFORE_END = new Date("2026-12-20T12:00:00.000Z");

function setup(api?: StaffApi) {
  const states: CodeCheckState[] = [];
  const staffApi =
    api ?? createMockStaffApi({ codes: MOCK_CODES, now: () => BEFORE_END });
  const view = createCodeCheck({
    api: staffApi,
    render: (state) => states.push(state),
  });
  const last = () => states[states.length - 1] ?? INITIAL_CODE_CHECK;
  return { view, states, last };
}

function failingApi(): StaffApi {
  return {
    checkCode: () => Promise.reject(new Error("down")),
    redeemCode: () => Promise.reject(new Error("down")),
  };
}

const VALID: CodeCheck = {
  code: "SYL-AB2C",
  status: "valid",
  nickname: "TestPlayer1",
  kind: "base",
  earnedAt: "2026-11-20T18:30:00.000Z",
  usedAt: null,
};

describe("labels", () => {
  it("names the four statuses in Polish", () => {
    expect(statusLabel("valid")).toBe("Ważny");
    expect(statusLabel("already_used")).toBe("Wykorzystany");
    expect(statusLabel("unknown")).toBe("Nieznany");
    expect(statusLabel("expired")).toBe("Wygasły");
  });

  it("shows 333 zl for the 10 % code and 299 zl for the share bonus", () => {
    expect(discountLabel("base")).toBe("10% · 333 zł / os.");
    expect(discountLabel("share")).toBe("Bonus za polecenia · 299 zł / os.");
    expect(discountLabel(null)).toBe(pl.panelEmptyValue);
  });

  it("shows the date earned in Warsaw time", () => {
    expect(earnedLabel("2026-11-20T18:30:00.000Z")).toBe("20.11.2026, 19:30");
    expect(earnedLabel(null)).toBe(pl.panelEmptyValue);
    expect(earnedLabel("not a date")).toBe(pl.panelEmptyValue);
  });
});

describe("canRedeem", () => {
  it("is true only for a valid code when no call is running", () => {
    const base = { ...INITIAL_CODE_CHECK, check: VALID };
    expect(canRedeem(base)).toBe(true);
    expect(canRedeem({ ...base, busy: true })).toBe(false);
    expect(canRedeem(INITIAL_CODE_CHECK)).toBe(false);
    for (const status of ["already_used", "unknown", "expired"] as const) {
      expect(canRedeem({ ...base, check: { ...VALID, status } })).toBe(false);
    }
  });
});

describe("createCodeCheck", () => {
  it("checks a valid code and allows the redeem", async () => {
    const { view, last } = setup();
    await view.check("  syl-ab2c ");
    expect(last()).toMatchObject({
      code: "SYL-AB2C",
      busy: false,
      error: null,
    });
    expect(last().check?.status).toBe("valid");
    expect(canRedeem(last())).toBe(true);
  });

  it("shows busy while the check runs", async () => {
    const { view, states } = setup();
    await view.check("SYL-AB2C");
    expect(states[0]).toMatchObject({ code: "SYL-AB2C", busy: true });
  });

  it("checks an already used code and blocks the redeem", async () => {
    const { view, last } = setup();
    await view.check("SYL-USED");
    expect(last().check?.status).toBe("already_used");
    expect(canRedeem(last())).toBe(false);
  });

  it("checks an unknown code and blocks the redeem", async () => {
    const { view, last } = setup();
    await view.check("SYL-ZZZZ");
    expect(last().check?.status).toBe("unknown");
    await view.redeem();
    expect(last().check?.status).toBe("unknown");
    expect(canRedeem(last())).toBe(false);
  });

  it("checks an expired code and does not redeem it", async () => {
    const after = new Date(STAFF.codeExpiresAtIso);
    const api = createMockStaffApi({ codes: MOCK_CODES, now: () => after });
    const { view, last } = setup(api);
    await view.check("SYL-AB2C");
    expect(last().check?.status).toBe("expired");
    await view.redeem();
    expect((await api.checkCode("SYL-AB2C")).status).toBe("expired");
  });

  it("redeems a valid code one time, then shows used", async () => {
    let redeemCalls = 0;
    const mock = createMockStaffApi({
      codes: MOCK_CODES,
      now: () => BEFORE_END,
    });
    const api: StaffApi = {
      checkCode: mock.checkCode,
      redeemCode: (code) => {
        redeemCalls += 1;
        return mock.redeemCode(code);
      },
    };
    const { view, last } = setup(api);
    await view.check("SYL-AB2C");
    await view.redeem();
    expect(last().check?.status).toBe("already_used");
    expect(last().redeemed).toBe(true);
    expect(canRedeem(last())).toBe(false);
    await view.redeem();
    expect(redeemCalls).toBe(1);
  });

  it("ignores a second redeem while the first one runs", async () => {
    let redeemCalls = 0;
    const api: StaffApi = {
      checkCode: () => Promise.resolve(VALID),
      redeemCode: () => {
        redeemCalls += 1;
        return Promise.resolve({
          ok: true,
          check: { ...VALID, status: "already_used" },
        });
      },
    };
    const { view } = setup(api);
    await view.check("SYL-AB2C");
    await Promise.all([view.redeem(), view.redeem()]);
    expect(redeemCalls).toBe(1);
  });

  it("shows the new state when the backend refuses the redeem", async () => {
    const api: StaffApi = {
      checkCode: () => Promise.resolve(VALID),
      redeemCode: () =>
        Promise.resolve({
          ok: false,
          check: { ...VALID, status: "already_used" },
        }),
    };
    const { view, last } = setup(api);
    await view.check("SYL-AB2C");
    await view.redeem();
    expect(last().check?.status).toBe("already_used");
    expect(last().redeemed).toBe(false);
  });

  it("asks for a code and does not call the API when the input is empty", async () => {
    const { view, last } = setup(failingApi());
    await view.check("   ");
    expect(last()).toMatchObject({ error: "empty", check: null, busy: false });
  });

  it("shows a calm error when the check call fails", async () => {
    const { view, last } = setup(failingApi());
    await view.check("SYL-AB2C");
    expect(last()).toMatchObject({ error: "check", check: null, busy: false });
  });

  it("keeps the result and shows a calm error when the redeem call fails", async () => {
    const api: StaffApi = {
      checkCode: () => Promise.resolve(VALID),
      redeemCode: () => Promise.reject(new Error("down")),
    };
    const { view, last } = setup(api);
    await view.check("SYL-AB2C");
    await view.redeem();
    expect(last()).toMatchObject({ error: "redeem", busy: false });
    expect(last().check?.status).toBe("valid");
  });

  it("clears the result on reset", async () => {
    const { view, last } = setup();
    await view.check("SYL-AB2C");
    view.reset();
    expect(last()).toEqual(INITIAL_CODE_CHECK);
  });
});
