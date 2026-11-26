/** Deterministic PRNG. The same seed must give the same stream in the replay. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed when the server has not issued one yet (fallback path). */
export function localSeed(): number {
  const bytes = new Uint8Array(4);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    return new DataView(bytes.buffer).getUint32(0);
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}
