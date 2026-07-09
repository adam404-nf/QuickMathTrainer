import { describe, expect, it } from "vitest";
import {
  HARD_TEMPLATE_CATEGORIES,
  MAX_SAME_KIND_EXTRA,
  NON_ZERO_STEP_TARGET,
  ZERO_STEP_ACCEPT_RATE,
  THEME_STEP_TARGET,
  categoryWeightForMode,
  decimalCapForContext,
  hardExcludedCategories,
  isCategoryAllowed,
  isDecimalTemplateCategory,
  isHardTemplateCategory,
  mixedHardTemplateTarget,
  neverRelaxCostRange,
  relaxationOrder,
  themeStepTarget,
  type TemplateCategory,
} from "./selectionPolicy";

describe("selectionPolicy constants", () => {
  it("defines hard-template categories and decimal-only decimal definition", () => {
    expect(HARD_TEMPLATE_CATEGORIES).toEqual([
      "fraction",
      "power",
      "conversion",
      "mixed-decimal-fraction",
    ]);
    expect(isDecimalTemplateCategory("decimal")).toBe(true);
    expect(isDecimalTemplateCategory("conversion")).toBe(false);
    expect(isDecimalTemplateCategory("mixed-decimal-fraction")).toBe(false);
    for (const c of HARD_TEMPLATE_CATEGORIES) {
      expect(isHardTemplateCategory(c)).toBe(true);
    }
    expect(isHardTemplateCategory("integer")).toBe(false);
    expect(isHardTemplateCategory("decimal")).toBe(false);
  });

  it("exposes non-zero and theme targets", () => {
    expect(NON_ZERO_STEP_TARGET).toBe(0.98);
    expect(ZERO_STEP_ACCEPT_RATE).toBe(0.02);
    expect(THEME_STEP_TARGET).toBe(0.7);
    expect(MAX_SAME_KIND_EXTRA).toBe(2);
  });
});

describe("decimalCapForContext", () => {
  it("returns 0.1 for mixed and powers", () => {
    expect(decimalCapForContext({ mode: "mixed" })).toBe(0.1);
    expect(decimalCapForContext({ mode: "powers" })).toBe(0.1);
  });

  it("returns 0.2 for fractions specialty", () => {
    expect(decimalCapForContext({ mode: "fractions" })).toBe(0.2);
  });

  it("returns 0 for arithmetic hard exclusion", () => {
    expect(decimalCapForContext({ mode: "arithmetic" })).toBe(0);
  });

  it("disables decimal cap for weakness-focused decimals", () => {
    expect(
      decimalCapForContext({ mode: "weakness-focused", targetTags: ["decimals"] }),
    ).toBeNull();
  });
});

describe("mixedHardTemplateTarget", () => {
  it("matches difficulty table", () => {
    expect(mixedHardTemplateTarget("easy")).toBe(0.65);
    expect(mixedHardTemplateTarget("medium")).toBe(0.7);
    expect(mixedHardTemplateTarget("hard")).toBe(0.75);
    expect(mixedHardTemplateTarget("extreme")).toBe(0.8);
  });
});

describe("mode hard exclusions", () => {
  const all: TemplateCategory[] = [
    "integer",
    "fraction",
    "decimal",
    "power",
    "conversion",
    "mixed-decimal-fraction",
  ];

  it("arithmetic allows only integer", () => {
    expect(hardExcludedCategories("arithmetic")).toEqual([
      "fraction",
      "decimal",
      "power",
      "conversion",
      "mixed-decimal-fraction",
    ]);
    for (const c of all) {
      expect(isCategoryAllowed("arithmetic", c)).toBe(c === "integer");
    }
  });

  it("fractions forbids power only", () => {
    expect(hardExcludedCategories("fractions")).toEqual(["power"]);
    for (const c of all) {
      expect(isCategoryAllowed("fractions", c)).toBe(c !== "power");
    }
  });

  it("mixed and weakness-focused do not use arithmetic/fractions hard table", () => {
    expect(hardExcludedCategories("mixed")).toEqual([]);
    expect(hardExcludedCategories("weakness-focused")).toEqual([]);
    expect(hardExcludedCategories("powers")).toEqual([]);
  });
});

describe("theme and relaxation", () => {
  it("theme target is 0.7 for specialty and weakness", () => {
    expect(themeStepTarget({ mode: "fractions" })).toBe(0.7);
    expect(themeStepTarget({ mode: "arithmetic" })).toBe(0.7);
    expect(themeStepTarget({ mode: "powers" })).toBe(0.7);
    expect(themeStepTarget({ mode: "weakness-focused", targetTags: ["decimals"] })).toBe(0.7);
    expect(themeStepTarget({ mode: "mixed" })).toBe(0);
  });

  it("relaxes decimal-cap before theme/hard ratios and never cost range", () => {
    expect(relaxationOrder()).toEqual([
      "decimal-cap",
      "theme-ratio",
      "hard-template-ratio",
    ]);
    expect(neverRelaxCostRange()).toBe(true);
  });
});

describe("categoryWeightForMode", () => {
  it("gives arithmetic zero weight to non-integer", () => {
    expect(categoryWeightForMode({ mode: "arithmetic", difficulty: "medium" }, "integer")).toBeGreaterThan(0);
    expect(categoryWeightForMode({ mode: "arithmetic", difficulty: "medium" }, "decimal")).toBe(0);
    expect(categoryWeightForMode({ mode: "arithmetic", difficulty: "medium" }, "fraction")).toBe(0);
  });

  it("gives fractions zero weight to power", () => {
    expect(categoryWeightForMode({ mode: "fractions", difficulty: "medium" }, "power")).toBe(0);
    expect(categoryWeightForMode({ mode: "fractions", difficulty: "medium" }, "fraction")).toBeGreaterThan(0);
  });

  it("boosts hard categories in mixed extreme vs easy", () => {
    const hardExtreme = categoryWeightForMode({ mode: "mixed", difficulty: "extreme" }, "fraction");
    const hardEasy = categoryWeightForMode({ mode: "mixed", difficulty: "easy" }, "fraction");
    const intExtreme = categoryWeightForMode({ mode: "mixed", difficulty: "extreme" }, "integer");
    const intEasy = categoryWeightForMode({ mode: "mixed", difficulty: "easy" }, "integer");
    expect(hardExtreme / (hardExtreme + intExtreme)).toBeGreaterThan(hardEasy / (hardEasy + intEasy));
  });
});
