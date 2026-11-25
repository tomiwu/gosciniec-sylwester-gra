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
  const key = (type: string, k: string) => {
    const event = Object.assign(new Event(type, { cancelable: true }), {
      key: k,
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
    expect(input.read()).toEqual({ dir: 0, targetX: null });
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

  it("takes the control back from the pointer", () => {
    const { input, key, ptr } = setup();
    ptr("pointerdown", 100);
    key("keydown", "ArrowRight");
    expect(input.read().targetX).toBeNull();
  });
});

describe("pointer", () => {
  it("follows a touch drag and lets go on release", () => {
    const { input, ptr } = setup();
    ptr("pointermove", 80);
    expect(input.read().targetX).toBeNull();
    ptr("pointerdown", 100);
    expect(input.read().targetX).toBe(50);
    ptr("pointermove", 140);
    expect(input.read().targetX).toBe(70);
    ptr("pointerup", 140);
    expect(input.read().targetX).toBeNull();
  });

  it("follows the mouse without a button and keeps the target on release", () => {
    const { input, ptr } = setup();
    ptr("pointermove", 60, "mouse");
    expect(input.read().targetX).toBe(30);
    ptr("pointerdown", 80, "mouse");
    ptr("pointerup", 80, "mouse");
    expect(input.read().targetX).toBe(40);
  });

  it("clears the target when the pointer is cancelled", () => {
    const { input, ptr } = setup();
    ptr("pointerdown", 100);
    ptr("pointercancel", 100);
    expect(input.read().targetX).toBeNull();
  });
});

describe("dispose", () => {
  it("stops listening", () => {
    const { input, key, ptr } = setup();
    input.dispose();
    key("keydown", "ArrowLeft");
    ptr("pointerdown", 100);
    expect(input.read()).toEqual({ dir: 0, targetX: null });
  });
});
