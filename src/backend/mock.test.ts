import { describe, expect, it } from "vitest";
import { REWARD } from "../config";
import { createMockBackend } from "./mock";
import type { SubmitInput } from "./types";

const DECEMBER = new Date("2026-12-10T18:30:00.000Z");
const NEW_YEAR = new Date("2027-01-01T10:00:00.000Z");

function clock(start: Date): { now: () => Date; set: (d: Date) => void } {
  let current = start;
  return { now: () => current, set: (d) => (current = d) };
}

function play(overrides: Partial<SubmitInput> = {}): SubmitInput {
  return {
    nickname: "AdaTest",
    score: REWARD.discountScore,
    deviceId: "device-ada",
    ...overrides,
  };
}

describe("createMockBackend submit", () => {
  it("rejects a bad nickname and a wild score", async () => {
    const backend = createMockBackend();
    const badName = await backend.submit(play({ nickname: "" }));
    expect(badName).toMatchObject({ accepted: false, reason: "nickname" });
    const badScore = await backend.submit(play({ score: 9_999_999 }));
    expect(badScore).toMatchObject({ accepted: false, reason: "score" });
    const noDevice = await backend.submit(play({ deviceId: "" }));
    expect(noDevice).toMatchObject({ accepted: false, reason: "device" });
    const longDevice = await backend.submit(
      play({ deviceId: "d".repeat(101) }),
    );
    expect(longDevice).toMatchObject({ accepted: false, reason: "device" });
    expect(await backend.top(5)).toEqual([]);
  });

  it("gives a SYL-XXXX code when the score reaches the limit", async () => {
    const backend = createMockBackend();
    const result = await backend.submit(play());
    expect(result.accepted).toBe(true);
    expect(result.discountPercent).toBe(10);
    expect(result.code).toMatch(/^SYL-[2-9A-HJ-NP-Z]{4}$/);
    expect(result.referralNeeded).toBe(REWARD.referralNeeded);
  });

  it("does not give a code when the score is below the limit", async () => {
    const backend = createMockBackend();
    const result = await backend.submit(
      play({ score: REWARD.discountScore - 1 }),
    );
    expect(result).toMatchObject({
      accepted: true,
      code: "",
      discountPercent: 0,
    });
  });

  it("returns the same code for a repeat submit of the same nickname", async () => {
    const backend = createMockBackend();
    const first = await backend.submit(play());
    const again = await backend.submit(
      play({ nickname: " adatest ", score: REWARD.discountScore + 40 }),
    );
    expect(again.code).toBe(first.code);
    expect((await backend.listCodes(10, 0)).length).toBe(1);
  });

  it("gives a different code to each nickname", async () => {
    const backend = createMockBackend();
    const codes = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const result = await backend.submit(
        play({ nickname: `Test${i}`, deviceId: `device-${i}` }),
      );
      codes.add(result.code);
    }
    expect(codes.size).toBe(40);
  });

  it("does not use a slice of the nickname as the suffix", async () => {
    const backend = createMockBackend({
      randomInt: (max) => 8 % max,
    });
    const result = await backend.submit(play({ nickname: "AAAA" }));
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("code");
  });

  it("shows only nickname and score on the leaderboard, best first", async () => {
    const backend = createMockBackend();
    await backend.submit(play({ nickname: "AdaTest", score: 210 }));
    await backend.submit(play({ nickname: "BenTest", score: 300 }));
    await backend.submit(play({ nickname: "AdaTest", score: 120 }));
    expect(await backend.top(5)).toEqual([
      { nickname: "BenTest", score: 300 },
      { nickname: "AdaTest", score: 210 },
    ]);
  });
});

describe("createMockBackend check and redeem", () => {
  it("checks a valid code with nickname, 333 zl and the date earned", async () => {
    const backend = createMockBackend({ now: () => DECEMBER });
    const { code } = await backend.submit(play());
    expect(await backend.check(code.toLowerCase())).toEqual({
      code,
      status: "valid",
      nickname: "AdaTest",
      kind: "base",
      discountPercent: 10,
      pricePerPerson: 333,
      earnedAt: DECEMBER.toISOString(),
      usedAt: null,
    });
  });

  it("gives unknown for a code that does not exist", async () => {
    const backend = createMockBackend();
    const check = await backend.check("SYL-7K2P");
    expect(check.status).toBe("unknown");
    const redeem = await backend.redeem("SYL-7K2P");
    expect(redeem.ok).toBe(false);
    expect(redeem.check.status).toBe("unknown");
  });

  it("redeems a valid code once, then gives already_used", async () => {
    const time = clock(DECEMBER);
    const backend = createMockBackend({ now: time.now });
    const { code } = await backend.submit(play());
    const usedAt = new Date("2026-12-20T09:00:00.000Z");
    time.set(usedAt);
    const first = await backend.redeem(code, "front desk");
    expect(first.ok).toBe(true);
    expect(first.check).toMatchObject({
      status: "already_used",
      usedAt: usedAt.toISOString(),
    });
    const second = await backend.redeem(code);
    expect(second.ok).toBe(false);
    expect(second.check.status).toBe("already_used");
    expect((await backend.check(code)).status).toBe("already_used");
  });

  it("gives expired after the end date and does not redeem", async () => {
    const time = clock(DECEMBER);
    const backend = createMockBackend({ now: time.now });
    const { code } = await backend.submit(play());
    time.set(NEW_YEAR);
    expect((await backend.check(code)).status).toBe("expired");
    const redeem = await backend.redeem(code);
    expect(redeem.ok).toBe(false);
    expect(redeem.check).toMatchObject({ status: "expired", usedAt: null });
  });

  it("does not issue a new code after the end date", async () => {
    const backend = createMockBackend({ now: () => NEW_YEAR });
    const result = await backend.submit(play());
    expect(result).toMatchObject({ accepted: false, reason: "expired" });
  });
});

describe("createMockBackend referrals", () => {
  async function referrer() {
    const backend = createMockBackend({ now: () => DECEMBER });
    const { code } = await backend.submit(play());
    return { backend, code };
  }

  async function refer(
    backend: ReturnType<typeof createMockBackend>,
    code: string,
    count: number,
  ): Promise<void> {
    for (let i = 0; i < count; i += 1) {
      await backend.submit({
        nickname: `Friend${i}`,
        score: 40,
        deviceId: `device-friend-${i}`,
        referralCode: code.toLowerCase(),
      });
    }
  }

  it("upgrades the referrer code to 299 zl after 5 finished players", async () => {
    const { backend, code } = await referrer();
    await refer(backend, code, 4);
    expect((await backend.check(code)).pricePerPerson).toBe(333);
    await refer(backend, code, 5);
    const check = await backend.check(code);
    expect(check).toMatchObject({
      kind: "share",
      discountPercent: REWARD.referralPercent,
      pricePerPerson: 299,
    });
    const again = await backend.submit(play());
    expect(again).toMatchObject({
      code,
      discountPercent: REWARD.referralPercent,
      referralProgress: 5,
    });
  });

  it("counts a repeat device and nickname once", async () => {
    const { backend, code } = await referrer();
    for (let i = 0; i < 6; i += 1) {
      await backend.submit({
        nickname: i % 2 === 0 ? "Friend" : "FRIEND",
        score: 10,
        deviceId: "device-friend",
        referralCode: code,
      });
    }
    expect((await backend.submit(play())).referralProgress).toBe(1);
  });

  it("does not count self-referral by nickname or by device", async () => {
    const { backend, code } = await referrer();
    await backend.submit(play({ deviceId: "other", referralCode: code }));
    await backend.submit(play({ nickname: "AdaAlt", referralCode: code }));
    expect((await backend.submit(play())).referralProgress).toBe(0);
  });

  it("ignores an unknown referral code", async () => {
    const { backend } = await referrer();
    const result = await backend.submit(
      play({ nickname: "BenTest", deviceId: "d2", referralCode: "SYL-ZZZZ" }),
    );
    expect(result.accepted).toBe(true);
  });

  it("does not count a rejected round", async () => {
    const { backend, code } = await referrer();
    await backend.submit({
      nickname: "Friend",
      score: -1,
      deviceId: "device-friend",
      referralCode: code,
    });
    expect((await backend.submit(play())).referralProgress).toBe(0);
  });
});

describe("createMockBackend staff tools", () => {
  it("lists codes and counts stats", async () => {
    const time = clock(DECEMBER);
    const backend = createMockBackend({ now: time.now });
    const ada = await backend.submit(play());
    await backend.submit(play({ nickname: "BenTest", deviceId: "d2" }));
    await backend.submit(
      play({ nickname: "LowTest", deviceId: "d3", score: 10 }),
    );
    await backend.redeem(ada.code);
    const rows = await backend.listCodes(10, 0);
    expect(rows.map((r) => r.nickname)).toEqual(["BenTest", "AdaTest"]);
    expect(rows[1]).toMatchObject({
      code: ada.code,
      score: REWARD.discountScore,
      kind: "base",
      referrals: 0,
      earnedAt: DECEMBER.toISOString(),
      usedAt: DECEMBER.toISOString(),
    });
    expect(await backend.listCodes(1, 1)).toHaveLength(1);
    expect(await backend.stats()).toEqual({
      players: 3,
      codes: 2,
      shareCodes: 0,
      redeemed: 1,
    });
  });

  it("hides a nickname from the leaderboard", async () => {
    const backend = createMockBackend();
    await backend.submit(play());
    expect(await backend.hideNickname("adatest")).toBe(true);
    expect(await backend.top(5)).toEqual([]);
    expect(await backend.hideNickname("NoSuchTest")).toBe(false);
  });
});
