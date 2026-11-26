import { ANTI_CHEAT, FIELD } from "../config";
import type { InputState } from "./types";

export type InputKind = "kd" | "ku" | "pd" | "pm" | "pu";

export type InputLogEvent = {
  readonly t: number;
  readonly kind: InputKind;
  readonly x?: number;
  readonly key?: "L" | "R";
};

export type StepSample = {
  readonly dt: number;
  readonly dir: -1 | 0 | 1;
  readonly dragDx: number;
};

export type PackedLog = {
  readonly v: 1;
  readonly seed: number;
  readonly steps: string;
  readonly ev: string;
  readonly capped?: true;
};

const KIND_CODE: Record<InputKind, number> = {
  kd: 0,
  ku: 1,
  pd: 2,
  pm: 3,
  pu: 4,
};
const KIND_OF: InputKind[] = ["kd", "ku", "pd", "pm", "pu"];

function clampX(x: number): number {
  return Math.min(FIELD.width, Math.max(0, Math.round(x)));
}

function packInts(values: number[]): string {
  return values.join(",");
}

function unpackInts(raw: string): number[] {
  if (raw === "") return [];
  return raw.split(",").map((part) => Number(part));
}

export function encodeSteps(steps: readonly StepSample[]): string {
  const out: number[] = [];
  for (const step of steps) {
    out.push(
      Math.max(0, Math.round(step.dt)),
      step.dir,
      Math.round(step.dragDx),
    );
  }
  return packInts(out);
}

function stepFromCodes(
  dt: number,
  dir: number,
  dragDx: number,
): StepSample | null {
  if (dir !== -1 && dir !== 0 && dir !== 1) return null;
  return { dt, dir, dragDx };
}

function at(nums: number[], i: number, fallback: number): number {
  return nums[i] ?? fallback;
}

function stepAt(nums: number[], i: number): StepSample | null {
  return stepFromCodes(at(nums, i, 0), at(nums, i + 1, 99), at(nums, i + 2, 0));
}

export function decodeSteps(raw: string): StepSample[] {
  const nums = unpackInts(raw);
  const steps: StepSample[] = [];
  for (let i = 0; i + 2 < nums.length; i += 3) {
    const step = stepAt(nums, i);
    if (step) steps.push(step);
  }
  return steps;
}

function eventX(event: InputLogEvent): number {
  return event.x === undefined || event.key ? -1 : clampX(event.x);
}

function eventKeyCode(event: InputLogEvent): number {
  return event.key === "L" ? 1 : event.key === "R" ? 2 : 0;
}

function encodeOneEvent(event: InputLogEvent, lastT: number): number[] {
  const t = Math.round(event.t);
  return [
    Math.max(0, t - lastT),
    KIND_CODE[event.kind],
    eventX(event),
    eventKeyCode(event),
  ];
}

export function encodeEvents(events: readonly InputLogEvent[]): string {
  const out: number[] = [];
  let lastT = 0;
  for (const event of events) {
    out.push(...encodeOneEvent(event, lastT));
    lastT = Math.round(event.t);
  }
  return packInts(out);
}

function keyFromCode(code: number): "L" | "R" | undefined {
  if (code === 1) return "L";
  return code === 2 ? "R" : undefined;
}

function eventFromCodes(
  t: number,
  kindCode: number,
  x: number,
  keyCode: number,
): InputLogEvent | null {
  const kind = KIND_OF[kindCode];
  if (!kind) return null;
  const key = keyFromCode(keyCode);
  return { t, kind, ...(x >= 0 ? { x } : {}), ...(key ? { key } : {}) };
}

function eventQuad(nums: number[], i: number, t: number): InputLogEvent | null {
  return eventFromCodes(
    t,
    nums[i + 1] ?? -1,
    nums[i + 2] ?? -1,
    nums[i + 3] ?? 0,
  );
}

export function decodeEvents(raw: string): InputLogEvent[] {
  const nums = unpackInts(raw);
  const events: InputLogEvent[] = [];
  let t = 0;
  for (let i = 0; i + 3 < nums.length; i += 4) {
    t += nums[i] ?? 0;
    const event = eventQuad(nums, i, t);
    if (event) events.push(event);
  }
  return events;
}

function dropMoves(events: readonly InputLogEvent[]): InputLogEvent[] {
  return events.filter((event) => event.kind !== "pm");
}

/** Pack the seed, the step samples (for replay), and the events (for flags). */
function stringifyLog(
  seed: number,
  steps: readonly StepSample[],
  events: readonly InputLogEvent[],
  capped: boolean,
): string {
  return JSON.stringify({
    v: 1,
    seed,
    steps: encodeSteps(steps),
    ev: encodeEvents(events),
    ...(capped ? { capped: true } : {}),
  } satisfies PackedLog);
}

function shrinkEvents(
  pack: (events: readonly InputLogEvent[]) => string,
  events: readonly InputLogEvent[],
  maxBytes: number,
): string {
  const kept = dropMoves(events);
  let lo = 0;
  let hi = kept.length;
  let packed = pack([]);
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    packed = pack(kept.slice(kept.length - mid));
    if (packed.length <= maxBytes) lo = mid;
    else hi = mid - 1;
  }
  return pack(kept.slice(kept.length - lo));
}

export function packLog(
  seed: number,
  steps: readonly StepSample[],
  events: readonly InputLogEvent[],
  maxBytes: number = ANTI_CHEAT.logMaxBytes,
): string {
  const tryPack = (ev: readonly InputLogEvent[], capped: boolean): string =>
    stringifyLog(seed, steps, ev, capped);
  const packed = tryPack(events, false);
  if (packed.length <= maxBytes) return packed;
  const noMoves = tryPack(dropMoves(events), true);
  if (noMoves.length <= maxBytes) return noMoves;
  return shrinkEvents((ev) => tryPack(ev, true), events, maxBytes);
}

function isPackedShape(data: Partial<PackedLog>): data is PackedLog {
  return (
    data.v === 1 &&
    typeof data.seed === "number" &&
    typeof data.steps === "string" &&
    typeof data.ev === "string"
  );
}

function maybeCapped(capped: PackedLog["capped"]): { capped?: true } {
  return capped ? { capped: true } : {};
}

function packedFields(data: Partial<PackedLog>): PackedLog | null {
  if (!isPackedShape(data)) return null;
  return {
    v: 1,
    seed: data.seed,
    steps: data.steps,
    ev: data.ev,
    ...maybeCapped(data.capped),
  };
}

function asPacked(raw: string): PackedLog | null {
  try {
    return packedFields(JSON.parse(raw) as Partial<PackedLog>);
  } catch {
    return null;
  }
}

export function unpackLog(raw: string): {
  seed: number;
  steps: StepSample[];
  events: InputLogEvent[];
  capped: boolean;
} | null {
  const data = asPacked(raw);
  if (!data) return null;
  return {
    seed: data.seed >>> 0,
    steps: decodeSteps(data.steps),
    events: decodeEvents(data.ev),
    capped: data.capped === true,
  };
}

export function createInputLog(): {
  push(event: InputLogEvent): void;
  addStep(dt: number, input: InputState): void;
  pack(seed: number): string;
  events(): InputLogEvent[];
} {
  const events: InputLogEvent[] = [];
  const steps: StepSample[] = [];
  return {
    push: (event) => {
      events.push(event);
    },
    addStep: (dt, input) => {
      if (dt <= 0 && steps.length === 0) return;
      steps.push({ dt, dir: input.dir, dragDx: input.dragDx });
    },
    pack: (seed) => packLog(seed, steps, events),
    events: () => events,
  };
}
