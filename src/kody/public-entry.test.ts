import { describe, expect, it } from "vitest";
import entry from "./public-entry";

describe("public game entry", () => {
  it("sends the hosted root and /panel away from staff to the game shell", async () => {
    const root = await entry.fetch(new Request("https://game.example/"));
    expect(root.status).toBe(302);
    expect(root.headers.get("Location")).toBe(
      "https://game.example/_assets/index.html",
    );
    const panel = await entry.fetch(new Request("https://game.example/panel/"));
    expect(panel.headers.get("Location")).toBe(
      "https://game.example/_assets/index.html",
    );
  });

  it("does not handle /_assets itself", async () => {
    const assets = await entry.fetch(
      new Request("https://game.example/_assets/index.html"),
    );
    expect(assets.status).toBe(404);
  });
});
