import { FIELD, JUMP } from "../config";
import type { JumpInputState } from "./types";

export interface JumpInputSources {
  readonly keys: EventTarget;
  readonly pointer: EventTarget;
  readonly jumpButton: EventTarget | null;
  readonly toFieldX: (clientX: number) => number;
}

export interface JumpInput {
  read(): JumpInputState;
  dispose(): void;
}

const LEFT_KEYS = new Set(["arrowleft", "a"]);
const RIGHT_KEYS = new Set(["arrowright", "d"]);
const JUMP_KEYS = new Set([" ", "arrowup", "w", "spacebar"]);

export function runAxisFromX(fieldX: number, width = FIELD.width): number {
  const centre = width / 2;
  const offset = fieldX - centre;
  if (Math.abs(offset) < JUMP.deadZonePx) return 0;
  const span = Math.max(1, centre - JUMP.deadZonePx);
  return Math.max(-1, Math.min(1, offset / span));
}

export function clientToFieldX(
  clientX: number,
  rectLeft: number,
  rectWidth: number,
  fieldWidth: number,
): number {
  if (rectWidth <= 0) return fieldWidth / 2;
  return ((clientX - rectLeft) / rectWidth) * fieldWidth;
}

function keySide(key: string): "left" | "right" | "jump" | null {
  const lower = key.toLowerCase();
  if (LEFT_KEYS.has(lower)) return "left";
  if (RIGHT_KEYS.has(lower)) return "right";
  return JUMP_KEYS.has(lower) ? "jump" : null;
}

export function createJumpInput(sources: JumpInputSources): JumpInput {
  let left = false;
  let right = false;
  let keyJump = false;
  let buttonHeld = false;
  let swipeHold = false;
  let jumpPressed = false;
  let pointerDown = false;
  let pointerAxis = 0;
  let pointerStartY = 0;
  const subscriptions: [EventTarget, string, EventListener][] = [];

  const listen = (target: EventTarget, type: string, fn: EventListener) => {
    target.addEventListener(type, fn);
    subscriptions.push([target, type, fn]);
  };

  const onKey = (down: boolean) => (event: Event) => {
    const { key, ctrlKey, metaKey } = event as KeyboardEvent;
    const side = keySide(key);
    if (side === null || (down && (ctrlKey || metaKey))) return;
    event.preventDefault();
    if (side === "left") left = down;
    else if (side === "right") right = down;
    else if (down) {
      if (!keyJump) jumpPressed = true;
      keyJump = true;
    } else keyJump = false;
  };

  const pointX = (event: Event) =>
    sources.toFieldX((event as PointerEvent).clientX);

  listen(sources.keys, "keydown", onKey(true));
  listen(sources.keys, "keyup", onKey(false));
  listen(sources.keys, "blur", () => {
    left = false;
    right = false;
    keyJump = false;
    swipeHold = false;
    pointerDown = false;
    pointerAxis = 0;
  });
  listen(sources.pointer, "pointerdown", (event) => {
    pointerDown = true;
    pointerAxis = runAxisFromX(pointX(event));
    pointerStartY = (event as PointerEvent).clientY;
  });
  listen(sources.pointer, "pointermove", (event) => {
    if (!pointerDown) return;
    pointerAxis = runAxisFromX(pointX(event));
    const dy = (event as PointerEvent).clientY - pointerStartY;
    if (dy < -40 && !swipeHold) {
      jumpPressed = true;
      swipeHold = true;
    }
  });
  const releasePointer = () => {
    pointerDown = false;
    pointerAxis = 0;
    swipeHold = false;
  };
  listen(sources.pointer, "pointerup", releasePointer);
  listen(sources.pointer, "pointercancel", releasePointer);

  if (sources.jumpButton) {
    listen(sources.jumpButton, "pointerdown", (event) => {
      event.preventDefault();
      if (!buttonHeld) jumpPressed = true;
      buttonHeld = true;
    });
    listen(sources.jumpButton, "pointerup", () => {
      buttonHeld = false;
    });
    listen(sources.jumpButton, "pointercancel", () => {
      buttonHeld = false;
    });
  }

  return {
    read: () => {
      const keyAxis = (Number(right) - Number(left)) as -1 | 0 | 1;
      const axis = keyAxis !== 0 ? keyAxis : pointerDown ? pointerAxis : 0;
      const pressed = jumpPressed;
      jumpPressed = false;
      return {
        axis,
        jumpDown: keyJump || buttonHeld || swipeHold,
        jumpPressed: pressed,
      };
    },
    dispose: () => {
      for (const [target, type, fn] of subscriptions) {
        target.removeEventListener(type, fn);
      }
    },
  };
}
