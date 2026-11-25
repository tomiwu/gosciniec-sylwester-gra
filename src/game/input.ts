import type { InputState } from "./types";

export interface InputSources {
  /** Receives keydown and keyup. Usually `window`. */
  readonly keys: EventTarget;
  /** Receives pointer events. Usually the canvas. */
  readonly pointer: EventTarget;
  /** Maps a screen x to a field x. */
  readonly toFieldX: (clientX: number) => number;
}

export interface GameInput {
  read(): InputState;
  dispose(): void;
}

const LEFT_KEYS = new Set(["arrowleft", "a"]);
const RIGHT_KEYS = new Set(["arrowright", "d"]);

export function clientToFieldX(
  clientX: number,
  rectLeft: number,
  rectWidth: number,
  fieldWidth: number,
): number {
  if (rectWidth <= 0) return fieldWidth / 2;
  return ((clientX - rectLeft) / rectWidth) * fieldWidth;
}

function sideOf(key: string): "left" | "right" | null {
  const lower = key.toLowerCase();
  if (LEFT_KEYS.has(lower)) return "left";
  return RIGHT_KEYS.has(lower) ? "right" : null;
}

export function createInput(sources: InputSources): GameInput {
  let left = false;
  let right = false;
  let pressed = false;
  let lastX: number | null = null;
  let pendingDx = 0;
  const subscriptions: [EventTarget, string, EventListener][] = [];

  const listen = (target: EventTarget, type: string, fn: EventListener) => {
    target.addEventListener(type, fn);
    subscriptions.push([target, type, fn]);
  };

  const onKey = (down: boolean) => (event: Event) => {
    const { key, ctrlKey, metaKey } = event as KeyboardEvent;
    const side = sideOf(key);
    if (side === null || (down && (ctrlKey || metaKey))) return;
    event.preventDefault();
    if (side === "left") left = down;
    else right = down;
  };

  const point = (event: Event) =>
    sources.toFieldX((event as PointerEvent).clientX);

  listen(sources.keys, "keydown", onKey(true));
  listen(sources.keys, "keyup", onKey(false));
  listen(sources.keys, "blur", () => {
    left = false;
    right = false;
  });
  listen(sources.pointer, "pointerdown", (event) => {
    pressed = true;
    lastX = point(event);
  });
  listen(sources.pointer, "pointermove", (event) => {
    if (!pressed || lastX === null) return;
    const x = point(event);
    pendingDx += x - lastX;
    lastX = x;
  });
  const release = () => {
    pressed = false;
    lastX = null;
  };
  listen(sources.pointer, "pointerup", release);
  listen(sources.pointer, "pointercancel", release);

  return {
    read: () => {
      const dragDx = pendingDx;
      pendingDx = 0;
      return {
        dir: (Number(right) - Number(left)) as -1 | 0 | 1,
        dragDx,
      };
    },
    dispose: () => {
      for (const [target, type, fn] of subscriptions) {
        target.removeEventListener(type, fn);
      }
    },
  };
}
