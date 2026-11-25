import { describe, expect, it } from "vitest";
import { FIELD } from "../config";
import { clientToFieldX, createInput } from "./input";

function setup() {
  const keys = new EventTarget();
  const pointer = new EventTarget();
  const input = createInput({
    keys,
    pointer,
    toFieldX: (clientX) => clientX / 2,
  });
  const key = (type: string, k: string, mods: object = {}) => {
    const event = Object.assign(new Event(type, { cancelable: true }), {
      key: k,
      ...mods,
    });
    keys.dispatchEvent(event);
    return event;
  };
  const ptr = (type: string, clientX: number, pointerType = "touch") =>
    pointer.dispatchEvent(
      Object.assign(new Event(type), { clientX, pointerType }),
    );
  return { input, key, ptr, keys, pointer };
}

describe("clientToFieldX", () => {
  it("maps a screen x to a field x", () => {
    expect(clientToFieldX(150, 50, 200, FIELD.width)).toBeCloseTo(
      FIELD.width / 2,
      6,
    );
  });

  it("returns the middle for an empty canvas", () => {
    expect(clientToFieldX(10, 0, 0, FIELD.width)).toBe(FIELD.width / 2);
  });
});

describe("keyboard", () => {
  it("reads arrows and A/D", () => {
    const { input, key } = setup();
    expect(input.read()).toEqual({ dir: 0, dragDx: 0 });
    key("keydown", "ArrowLeft");
    expect(input.read().dir).toBe(-1);
    key("keyup", "ArrowLeft");
    key("keydown", "d");
    expect(input.read().dir).toBe(1);
    key("keyup", "d");
    key("keydown", "A");
    expect(input.read().dir).toBe(-1);
    key("keyup", "A");
    key("keydown", "ArrowRight");
    expect(input.read().dir).toBe(1);
  });

  it("cancels out when both sides are held", () => {
    const { input, key } = setup();
    key("keydown", "ArrowLeft");
    key("keydown", "ArrowRight");
    expect(input.read().dir).toBe(0);
  });

  it("stops the page from scrolling on arrows only", () => {
    const { key } = setup();
    expect(key("keydown", "ArrowLeft").defaultPrevented).toBe(true);
    expect(key("keydown", "x").defaultPrevented).toBe(false);
  });

  it("leaves browser shortcuts such as Ctrl+D alone", () => {
    const { input, key } = setup();
    const event = key("keydown", "d", { ctrlKey: true });
    expect(event.defaultPrevented).toBe(false);
    expect(input.read().dir).toBe(0);
    key("keydown", "d");
    key("keydown", "ArrowLeft", { metaKey: true });
    key("keyup", "d", { ctrlKey: true });
    expect(input.read().dir).toBe(0);
  });

  it("lets go of the keys when the window loses focus", () => {
    const { input, key, keys } = setup();
    key("keydown", "ArrowLeft");
    keys.dispatchEvent(new Event("blur"));
    expect(input.read().dir).toBe(0);
  });

  it("can steer with the keyboard while a pointer is held still", () => {
    const { input, key, ptr } = setup();
    ptr("pointerdown", 100);
    key("keydown", "ArrowRight");
    expect(input.read()).toEqual({ dir: 1, dragDx: 0 });
  });
});

describe("pointer", () => {
  it("moves only by the drag delta and is idle when the finger is still", () => {
    const { input, ptr } = setup();
    ptr("pointermove", 80);
    expect(input.read().dragDx).toBe(0);
    ptr("pointerdown", 100);
    expect(input.read().dragDx).toBe(0);
    ptr("pointermove", 140);
    // toFieldX = clientX / 2, so 140 - 100 maps to +20
    expect(input.read().dragDx).toBe(20);
    expect(input.read().dragDx).toBe(0);
    ptr("pointerup", 140);
    ptr("pointermove", 200);
    expect(input.read().dragDx).toBe(0);
  });

  it("does not follow a mouse hover, only a pressed drag", () => {
    const { input, ptr } = setup();
    ptr("pointermove", 60, "mouse");
    expect(input.read().dragDx).toBe(0);
    ptr("pointerdown", 80, "mouse");
    ptr("pointermove", 120, "mouse");
    expect(input.read().dragDx).toBe(20);
    ptr("pointerup", 120, "mouse");
    ptr("pointermove", 200, "mouse");
    expect(input.read().dragDx).toBe(0);
  });

  it("stops the drag when the pointer is cancelled", () => {
    const { input, ptr } = setup();
    ptr("pointerdown", 100);
    ptr("pointermove", 140);
    ptr("pointercancel", 140);
    expect(input.read().dragDx).toBe(20);
    ptr("pointermove", 200);
    expect(input.read().dragDx).toBe(0);
  });
});

describe("dispose", () => {
  it("stops listening", () => {
    const { input, key, ptr } = setup();
    input.dispose();
    key("keydown", "ArrowLeft");
    ptr("pointerdown", 100);
    expect(input.read()).toEqual({ dir: 0, dragDx: 0 });
  });
});
