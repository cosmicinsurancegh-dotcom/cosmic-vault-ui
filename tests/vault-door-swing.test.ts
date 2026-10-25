import { describe, expect, it } from "vitest";
import { makeDoor } from "../scripts/vault-door/door-model.mjs";
import { VAULT_ART } from "../src/components/landing/vault-door/art.generated";

describe("vault door swing", () => {
  it("draws the door, its hull and its shadow at every angle from shut to open", () => {
    for (let angle = 0; angle <= 90; angle += 5) {
      const door = makeDoor(VAULT_ART.P, angle);
      const { main, arms } = door.swing({ dialRot: 90 });
      expect(main.length).toBeGreaterThan(1000);
      expect(arms.length).toBeGreaterThan(100);
      expect(door.frontHull().length).toBeGreaterThan(2);
      expect(door.shadow()).toMatch(/^M/);
    }
  });
});
