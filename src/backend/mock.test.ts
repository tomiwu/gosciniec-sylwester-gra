import { describe, expect, it } from "vitest";
import { REWARD } from "../config";
import { createMockBackend } from "./mock";

describe("createMockBackend", () => {
  it("rejects a bad nickname and a wild score", async () => {
    const backend = createMockBackend();
    const badName = await backend.submit({
      nickname: "",
      score: 10,
      deviceId: "d1",
    });
    expect(badName.accepted).toBe(false);
    const badScore = await backend.submit({
      nickname: "Anna",
      score: 9_999_999,
      deviceId: "d1",
    });
    expect(badScore.accepted).toBe(false);
  });

  it("gives a SYL- code when the score reaches the limit", async () => {
    const backend = createMockBackend();
    const result = await backend.submit({
      nickname: "Anna",
      score: REWARD.discountScore,
      deviceId: "d1",
    });
    expect(result.accepted).toBe(true);
    expect(result.discountPercent).toBe(10);
    expect(result.code.startsWith("SYL-")).toBe(true);
    const top = await backend.top(1);
    expect(top[0]?.nickname).toBe("Anna");
  });

  it("does not give a code when the score is below the limit", async () => {
    const backend = createMockBackend();
    const result = await backend.submit({
      nickname: "Anna",
      score: REWARD.discountScore - 1,
      deviceId: "d1",
    });
    expect(result.accepted).toBe(true);
    expect(result.discountPercent).toBe(0);
    expect(result.code).toBe("");
  });
});
