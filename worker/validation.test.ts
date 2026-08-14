import { describe, expect, it } from "vitest";
import {
  enumArray,
  NEED_TYPES,
  rejectPublicContactInfo,
  targetCityAnchor
} from "./validation";

describe("need category validation", () => {
  it("preserves multiple distinct need dimensions", () => {
    expect(
      enumArray(
        ["water", "food", "funds"],
        NEED_TYPES,
        "Las necesidades",
        NEED_TYPES.length
      )
    ).toEqual(["water", "food", "funds"]);
  });

  it("removes duplicates without collapsing other categories", () => {
    expect(
      enumArray(
        ["water", "water", "medical"],
        NEED_TYPES,
        "Las necesidades",
        NEED_TYPES.length
      )
    ).toEqual(["water", "medical"]);
  });
});

describe("remote help location handling", () => {
  it("derives a non-personal anchor inside the selected target city", () => {
    const anchor = targetCityAnchor("manizales");

    expect(anchor.h3Cell).toMatch(/^[0-9a-f]+$/);
    expect(anchor.latitude).toBeGreaterThanOrEqual(4.99);
    expect(anchor.latitude).toBeLessThanOrEqual(5.16);
    expect(anchor.longitude).toBeGreaterThanOrEqual(-75.61);
    expect(anchor.longitude).toBeLessThanOrEqual(-75.4);
  });
});

describe("public discussion privacy", () => {
  it("rejects direct contact details while allowing ordinary coordination text", () => {
    expect(() => rejectPublicContactInfo("I can deliver supplies tomorrow.")).not.toThrow();
    expect(() => rejectPublicContactInfo("Email me at helper@example.org")).toThrow();
    expect(() => rejectPublicContactInfo("Call +1 (555) 123-4567")).toThrow();
  });
});
