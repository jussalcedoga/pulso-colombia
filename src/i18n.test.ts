import { describe, expect, it } from "vitest";
import { createTranslator } from "./i18n";

describe("createTranslator", () => {
  it("interpolates Spanish values", () => {
    expect(createTranslator("es")("people", { count: 12 })).toBe("12 personas");
  });

  it("returns the English equivalent", () => {
    expect(createTranslator("en")("needHelp")).toBe("I need help");
  });
});
