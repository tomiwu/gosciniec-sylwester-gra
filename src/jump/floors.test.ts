import { describe, expect, it } from "vitest";
import { FIELD, JUMP } from "../config";
import {
  extendFloors,
  floorKind,
  floorWidth,
  floorX,
  initialFloors,
  lootFor,
  makeFloor,
  nextFloorY,
  placeDecor,
  pruneFloors,
} from "./floors";

describe("floorWidth", () => {
  it("makes the ground floor almost full width", () => {
    expect(floorWidth(0, () => 1)).toBe(FIELD.width - 2 * JUMP.floorEdgePx);
  });

  it("narrows on higher floors", () => {
    expect(floorWidth(40, () => 0)).toBe(JUMP.floorWidthMin);
    expect(floorWidth(40, () => 1)).toBeGreaterThan(JUMP.floorWidthMin);
    expect(floorWidth(2, () => 1)).toBeGreaterThan(floorWidth(40, () => 1));
  });
});

describe("floorKind", () => {
  it("keeps the ground as a ledge and maps later rolls", () => {
    expect(floorKind(0, () => 0.99)).toBe("ledge");
    expect(floorKind(3, () => 0.05)).toBe("chandelier");
    expect(floorKind(3, () => 0.3)).toBe("tray");
    expect(floorKind(3, () => 0.9)).toBe("ledge");
  });
});

describe("floorX", () => {
  it("pins the ground to the left edge and alternates sides", () => {
    expect(floorX(0, 200, () => 0.5)).toBe(JUMP.floorEdgePx);
    const left = floorX(2, 200, () => 0);
    const right = floorX(3, 200, () => 0);
    expect(right).toBeGreaterThan(left);
  });
});

describe("nextFloorY", () => {
  it("steps up by a gap inside the configured range", () => {
    expect(nextFloorY(780, () => 0)).toBe(780 - JUMP.floorGapMin);
    expect(nextFloorY(780, () => 1)).toBe(780 - JUMP.floorGapMax);
  });
});

describe("lootFor", () => {
  it("keeps the first floors clear", () => {
    expect(lootFor(0, "ledge", () => 0)).toEqual({
      pickup: null,
      hazard: false,
    });
    expect(lootFor(1, "tray", () => 0)).toEqual({
      pickup: null,
      hazard: false,
    });
  });

  it("can place a hazard, a glass, a star, or a clock", () => {
    expect(lootFor(4, "ledge", () => 0)).toEqual({
      pickup: null,
      hazard: true,
    });
    expect(lootFor(4, "ledge", () => 0.2)).toEqual({
      pickup: "glass",
      hazard: false,
    });
    expect(lootFor(4, "chandelier", () => 0.99)).toEqual({
      pickup: null,
      hazard: false,
    });
    const values = [0.2, 0.6];
    expect(lootFor(4, "ledge", () => values.shift() ?? 0.6)).toEqual({
      pickup: "star",
      hazard: false,
    });
    const clock = [0.2, 0.95];
    expect(lootFor(4, "ledge", () => clock.shift() ?? 0.95)).toEqual({
      pickup: "clock",
      hazard: false,
    });
    const starOnArm = [0.2, 0.95];
    expect(lootFor(4, "chandelier", () => starOnArm.shift() ?? 0.95)).toEqual({
      pickup: "star",
      hazard: false,
    });
  });
});

describe("placeDecor and makeFloor", () => {
  it("places a pickup or a hazard on the floor centre", () => {
    const floor = makeFloor(7, 4, 400, () => 0.2);
    expect(floor.id).toBe(7);
    expect(floor.index).toBe(4);
    expect(floor.y).toBe(400);
    const withGlass = placeDecor(floor, { pickup: "glass", hazard: false }, 10);
    expect(withGlass.pickups).toHaveLength(1);
    expect(withGlass.pickups[0]?.x).toBe(floor.x + floor.width / 2);
    expect(withGlass.nextId).toBe(11);
    const withHazard = placeDecor(floor, { pickup: null, hazard: true }, 3);
    expect(withHazard.hazards).toHaveLength(1);
    expect(withHazard.nextId).toBe(4);
  });
});

describe("initialFloors and world growth", () => {
  it("starts with a ground floor and enough floors to fill the view", () => {
    const pack = initialFloors(() => 0.5);
    expect(pack.floors[0]?.index).toBe(0);
    expect(pack.floors[0]?.y).toBe(JUMP.groundY);
    expect(pack.floors.length).toBeGreaterThan(8);
    const grown = extendFloors(pack, -2_000, () => 0.5);
    expect(grown.floors.length).toBeGreaterThan(pack.floors.length);
    const last = grown.floors[grown.floors.length - 1];
    expect(last?.y).toBeLessThan(
      -2_000 - JUMP.generateAheadPx + JUMP.floorGapMax,
    );
    const trimmed = pruneFloors(grown, -2_000);
    expect(
      trimmed.floors.every(
        (floor) => floor.y < -2_000 + FIELD.height + JUMP.dropBehindPx,
      ),
    ).toBe(true);
    expect(extendFloors({ ...pack, floors: [] }, 0, () => 0.5).floors).toEqual(
      [],
    );
  });
});
