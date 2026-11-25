import { describe, expect, it } from "vitest";
import { DEPTH, FIELD } from "../config";
import { itemScale, laneX, pickLane, project, screenY } from "./depth";

describe("project", () => {
  it("puts depth 0 on the horizon and depth 1 on the catch line", () => {
    expect(screenY(0)).toBeCloseTo(DEPTH.horizonY, 8);
    expect(screenY(DEPTH.catchZ)).toBeCloseTo(FIELD.playerY, 8);
  });

  it("grows items as they come closer", () => {
    expect(itemScale(0)).toBeCloseTo(DEPTH.itemSizeFar, 8);
    expect(itemScale(DEPTH.catchZ)).toBeCloseTo(DEPTH.itemSizeNear, 8);
    expect(itemScale(0.8)).toBeGreaterThan(itemScale(0.2));
  });

  it("spreads lanes wider near the couple than at the horizon", () => {
    const far = Math.abs(laneX(0, 0.1) - laneX(DEPTH.lanes - 1, 0.1));
    const near = Math.abs(laneX(0, 1) - laneX(DEPTH.lanes - 1, 1));
    expect(near).toBeGreaterThan(far);
    const mid = project(2, 1);
    expect(mid.x).toBeCloseTo(FIELD.width / 2, 5);
  });

  it("picks a lane from a roll", () => {
    expect(pickLane(0)).toBe(0);
    expect(pickLane(0.99)).toBe(DEPTH.lanes - 1);
  });
});
