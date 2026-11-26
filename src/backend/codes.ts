import { CODES, REWARD, discountedPrice } from "../config";
import type { CodeCheck, CodeStatus, DiscountKind } from "./types";

/** Returns an integer in [0, max). */
export type RandomInt = (max: number) => number;

export function cryptoRandomInt(max: number): number {
  const [value = 0] = globalThis.crypto.getRandomValues(new Uint32Array(1));
  return value % max;
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export function nicknameKey(nickname: string): string {
  return nickname.trim().toLowerCase();
}

export function isExpired(now: Date): boolean {
  return now.getTime() >= Date.parse(CODES.expiresAtIso);
}

export function isDeviceIdValid(deviceId: string): boolean {
  return deviceId.length >= 1 && deviceId.length <= CODES.deviceIdMaxLength;
}

/** True when the suffix is a piece of the nickname (letters and digits only). */
export function isSliceOf(suffix: string, nickname: string): boolean {
  const clean = nickname.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return clean.includes(suffix);
}

function randomSuffix(randomInt: RandomInt): string {
  const size = CODES.alphabet.length;
  return Array.from({ length: CODES.suffixLength }, () =>
    CODES.alphabet.charAt(randomInt(size)),
  ).join("");
}

/**
 * A new random `SYL-XXXX` code. The suffix is free and is not a slice of the nickname.
 * Null when no free code was found in `CODES.maxAttempts` attempts.
 */
export function makeCode(
  nickname: string,
  isTaken: (code: string) => boolean,
  randomInt: RandomInt = cryptoRandomInt,
): string | null {
  for (let attempt = 0; attempt < CODES.maxAttempts; attempt += 1) {
    const suffix = randomSuffix(randomInt);
    const code = `${REWARD.codePrefix}${suffix}`;
    if (!isSliceOf(suffix, nickname) && !isTaken(code)) return code;
  }
  return null;
}

/** Status of a known code. A used code stays `already_used` after the end date. */
export function codeStatus(usedAt: string | null, now: Date): CodeStatus {
  if (usedAt !== null) return "already_used";
  return isExpired(now) ? "expired" : "valid";
}

export function discountFor(kind: DiscountKind): {
  percent: number;
  price: number;
} {
  const percent =
    kind === "share" ? REWARD.referralPercent : REWARD.basePercent;
  return { percent, price: discountedPrice(percent) };
}

export function unknownCheck(code: string): CodeCheck {
  return {
    code: normalizeCode(code),
    status: "unknown",
    nickname: null,
    kind: null,
    discountPercent: 0,
    pricePerPerson: null,
    earnedAt: null,
    usedAt: null,
  };
}
