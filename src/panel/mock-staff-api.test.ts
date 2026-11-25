import { describe, expect, it } from "vitest";
import { STAFF } from "../config";
import { MOCK_CODES, createMockStaffApi } from "./mock-staff-api";

const BEFORE_END = new Date("2026-12-31T22:59:59.000Z");
const AFTER_END = new Date(STAFF.codeExpiresAtIso);

function api(now = BEFORE_END) {
  return createMockStaffApi({ codes: MOCK_CODES, now: () => now });
}

describe("createMockStaffApi", () => {
  it("returns valid for a known code that is not used, in any case", async () => {
    const check = await api().checkCode(" syl-ab2c ");
    expect(check).toMatchObject({
      code: "SYL-AB2C",
      status: "valid",
      kind: "base",
    });
    expect(check.nickname).not.toBeNull();
    expect(check.earnedAt).not.toBeNull();
  });

  it("returns unknown for a code that does not exist", async () => {
    expect(await api().checkCode("SYL-ZZZZ")).toEqual({
      code: "SYL-ZZZZ",
      status: "unknown",
      nickname: null,
      kind: null,
      earnedAt: null,
      usedAt: null,
    });
  });

  it("returns expired after 31 December 2026, 23:59:59 Warsaw time", async () => {
    expect((await api(AFTER_END).checkCode("SYL-AB2C")).status).toBe("expired");
  });

  it("returns already used for a used code, also after the end date", async () => {
    expect((await api().checkCode("SYL-USED")).status).toBe("already_used");
    expect((await api(AFTER_END).checkCode("SYL-USED")).status).toBe(
      "already_used",
    );
  });

  it("redeems a valid code one time only", async () => {
    const staff = api();
    const first = await staff.redeemCode("SYL-PX7K");
    expect(first.ok).toBe(true);
    expect(first.check.status).toBe("already_used");
    expect(first.check.usedAt).toBe(BEFORE_END.toISOString());
    const second = await staff.redeemCode("syl-px7k");
    expect(second.ok).toBe(false);
    expect(second.check.status).toBe("already_used");
    expect((await staff.checkCode("SYL-PX7K")).status).toBe("already_used");
  });

  it("does not redeem an unknown or an expired code", async () => {
    expect((await api().redeemCode("SYL-ZZZZ")).ok).toBe(false);
    const late = api(AFTER_END);
    expect((await late.redeemCode("SYL-AB2C")).ok).toBe(false);
    expect((await late.checkCode("SYL-AB2C")).status).toBe("expired");
  });

  it("does not change the seed list", async () => {
    await api().redeemCode("SYL-AB2C");
    expect((await api().checkCode("SYL-AB2C")).status).toBe("valid");
  });
});
