import { describe, expect, it } from "vitest";
import { createRng } from "./rng";

describe("createRng", () => {
  it("repeats the same stream for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const first = Array.from({ length: 8 }, () => a());
    const second = Array.from({ length: 8 }, () => b());
    expect(first).toEqual(second);
    expect(first.every((n) => n >= 0 && n < 1)).toBe(true);
  });

  it("changes the stream when the seed changes", () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });
});
