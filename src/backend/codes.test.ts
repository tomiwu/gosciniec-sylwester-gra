import { describe, expect, it } from "vitest";
import { CODES } from "../config";
import {
  codeStatus,
  discountFor,
  isExpired,
  isSliceOf,
  makeCode,
  nicknameKey,
  normalizeCode,
  unknownCheck,
} from "./codes";

function sequence(values: number[]): (max: number) => number {
  let index = 0;
  return (max) => {
    const value = values[index % values.length] ?? 0;
    index += 1;
    return value % max;
  };
}

describe("normalizeCode and nicknameKey", () => {
  it("trims and upper-cases a code", () => {
    expect(normalizeCode("  syl-7k2p ")).toBe("SYL-7K2P");
  });

  it("makes one key for the same nickname in any case", () => {
    expect(nicknameKey("  AdaTest ")).toBe(nicknameKey("adatest"));
  });
});

describe("isExpired", () => {
  it("keeps a code valid on 31 December 2026 at 23:59:59 in Warsaw", () => {
    expect(isExpired(new Date("2026-12-31T22:59:59.999Z"))).toBe(false);
  });

  it("expires a code at midnight in Warsaw", () => {
    expect(isExpired(new Date("2026-12-31T23:00:00.000Z"))).toBe(true);
  });
});

describe("makeCode", () => {
  it("makes a SYL-XXXX code from the safe alphabet", () => {
    const code = makeCode("AdaTest", () => false, sequence([5, 17, 0, 21]));
    expect(code).toBe("SYL-7K2P");
    expect(code).toMatch(/^SYL-[2-9A-HJ-NP-Z]{4}$/);
  });

  it("tries again when the code is taken", () => {
    const taken = new Set(["SYL-7K2P"]);
    const code = makeCode(
      "AdaTest",
      (c) => taken.has(c),
      sequence([5, 17, 0, 21, 1, 2, 3, 4]),
    );
    expect(code).toBe("SYL-3456");
  });

  it("tries again when the suffix is a slice of the nickname", () => {
    const code = makeCode(
      "XABCDX",
      () => false,
      sequence([8, 9, 10, 11, 1, 2, 3, 4]),
    );
    expect(code).toBe("SYL-3456");
  });

  it("gives null when every attempt fails", () => {
    expect(makeCode("AdaTest", () => true, sequence([0]))).toBeNull();
  });

  it("uses crypto random values by default", () => {
    const codes = new Set(
      Array.from({ length: 50 }, () => makeCode("AdaTest", () => false)),
    );
    expect(codes.size).toBeGreaterThan(45);
  });

  it("has a 32-character alphabet without 0, 1, I and O", () => {
    expect(CODES.alphabet).toHaveLength(32);
    expect(CODES.alphabet).not.toMatch(/[01IO]/);
  });
});

describe("isSliceOf", () => {
  it("finds a suffix inside the cleaned nickname", () => {
    expect(isSliceOf("ADAT", "Ada Test")).toBe(true);
    expect(isSliceOf("7K2P", "AdaTest")).toBe(false);
  });
});

describe("codeStatus", () => {
  const before = new Date("2026-12-01T12:00:00Z");
  const after = new Date("2027-01-02T12:00:00Z");

  it("is valid before the end date when not used", () => {
    expect(codeStatus(null, before)).toBe("valid");
  });

  it("is already_used after a redeem, also after the end date", () => {
    expect(codeStatus("2026-12-20T10:00:00.000Z", before)).toBe("already_used");
    expect(codeStatus("2026-12-20T10:00:00.000Z", after)).toBe("already_used");
  });

  it("is expired after the end date when not used", () => {
    expect(codeStatus(null, after)).toBe("expired");
  });
});

describe("discountFor", () => {
  it("gives 10 % and 333 zl for a base code", () => {
    expect(discountFor("base")).toEqual({ percent: 10, price: 333 });
  });

  it("gives the share bonus price of 299 zl for a share code", () => {
    expect(discountFor("share")).toEqual({ percent: 20, price: 299 });
  });
});

describe("unknownCheck", () => {
  it("gives an empty check with status unknown", () => {
    expect(unknownCheck(" syl-zzzz")).toEqual({
      code: "SYL-ZZZZ",
      status: "unknown",
      nickname: null,
      kind: null,
      discountPercent: 0,
      pricePerPerson: null,
      earnedAt: null,
      usedAt: null,
    });
  });
});
