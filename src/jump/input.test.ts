import { describe, expect, it } from "vitest";
import { FIELD, JUMP } from "../config";
import { clientToFieldX, createJumpInput, runAxisFromX } from "./input";

describe("runAxisFromX", () => {
  it("is 0 in the dead zone and reaches 1 at the edge", () => {
    expect(runAxisFromX(FIELD.width / 2)).toBe(0);
    expect(runAxisFromX(FIELD.width / 2 + JUMP.deadZonePx - 1)).toBe(0);
    expect(runAxisFromX(FIELD.width)).toBe(1);
    expect(runAxisFromX(0)).toBe(-1);
  });
});

describe("clientToFieldX", () => {
  it("maps a screen x to a field x", () => {
    expect(clientToFieldX(50, 0, 100, 390)).toBe(195);
    expect(clientToFieldX(0, 0, 0, 390)).toBe(195);
  });
});

function setup(withButton = true) {
  const keys = new EventTarget();
  const pointer = new EventTarget();
  const button = withButton ? new EventTarget() : null;
  const input = createJumpInput({
    keys,
    pointer,
    jumpButton: button,
    toFieldX: (x) => x,
  });
  const key = (type: string, k: string, mods: object = {}) => {
    const event = Object.assign(new Event(type, { cancelable: true }), {
      key: k,
      ...mods,
    });
    keys.dispatchEvent(event);
    return event;
  };
  const ptr = (type: string, clientX: number, clientY = 400) =>
    pointer.dispatchEvent(Object.assign(new Event(type), { clientX, clientY }));
  const btn = (type: string) => {
    if (!button) return false;
    return button.dispatchEvent(
      Object.assign(new Event(type, { cancelable: true })),
    );
  };
  return { input, key, ptr, btn, keys };
}

describe("createJumpInput", () => {
  it("reads keyboard run and jump, and ignores modified keys", () => {
    const { input, key } = setup();
    key("keydown", "ArrowRight");
    expect(input.read()).toMatchObject({
      axis: 1,
      jumpDown: false,
      jumpPressed: false,
    });
    key("keydown", " ");
    const pressed = input.read();
    expect(pressed.jumpPressed).toBe(true);
    expect(pressed.jumpDown).toBe(true);
    expect(input.read().jumpPressed).toBe(false);
    key("keyup", " ");
    key("keyup", "ArrowRight");
    expect(input.read()).toMatchObject({ axis: 0, jumpDown: false });
    key("keydown", "d", { ctrlKey: true, metaKey: false });
    expect(input.read().axis).toBe(0);
    input.dispose();
  });

  it("runs from a held pointer and jumps from a swipe or the button", () => {
    const { input, ptr, btn, keys } = setup();
    ptr("pointerdown", FIELD.width, 400);
    expect(input.read().axis).toBe(1);
    ptr("pointermove", FIELD.width, 340);
    expect(input.read().jumpPressed).toBe(true);
    ptr("pointerup", FIELD.width, 340);
    expect(input.read().axis).toBe(0);
    btn("pointerdown");
    expect(input.read()).toMatchObject({ jumpPressed: true, jumpDown: true });
    btn("pointerup");
    expect(input.read().jumpDown).toBe(false);
    keys.dispatchEvent(new Event("blur"));
    expect(input.read()).toMatchObject({ axis: 0, jumpDown: false });
    input.dispose();
  });

  it("clears a cancelled pointer and still works without a jump button", () => {
    const { input, ptr } = setup(false);
    ptr("pointerdown", 0, 200);
    expect(input.read().axis).toBe(-1);
    ptr("pointercancel", 0, 200);
    expect(input.read().axis).toBe(0);
    input.dispose();
  });
});
