import { describe, expect, it } from "vitest";
import {
  absoluteValueOperandRange,
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
  isThemeCategory,
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

const ALL_CATEGORIES: TemplateCategory[] = [
  "integer",
  "fraction",
  "decimal",
  "power",
  "conversion",
  "mixed-decimal-fraction",
];

describe("isThemeCategory", () => {
  it("arithmetic treats only integer as theme", () => {
    const input = { mode: "arithmetic" as const };
    expect(isThemeCategory(input, "integer")).toBe(true);
    for (const c of ALL_CATEGORIES.filter((c) => c !== "integer")) {
      expect(isThemeCategory(input, c)).toBe(false);
    }
  });

  it("fractions treats fraction/decimal/conversion/mixed-decimal-fraction as theme", () => {
    const input = { mode: "fractions" as const };
    const theme = ["fraction", "decimal", "conversion", "mixed-decimal-fraction"] as const;
    for (const c of theme) {
      expect(isThemeCategory(input, c)).toBe(true);
    }
    expect(isThemeCategory(input, "integer")).toBe(false);
    expect(isThemeCategory(input, "power")).toBe(false);
  });

  it("powers treats only power as theme", () => {
    const input = { mode: "powers" as const };
    expect(isThemeCategory(input, "power")).toBe(true);
    for (const c of ALL_CATEGORIES.filter((c) => c !== "power")) {
      expect(isThemeCategory(input, c)).toBe(false);
    }
  });

  it("mixed treats no category as theme", () => {
    const input = { mode: "mixed" as const };
    for (const c of ALL_CATEGORIES) {
      expect(isThemeCategory(input, c)).toBe(false);
    }
  });

  it("weakness-focused decimals treats only decimal as theme", () => {
    const input = { mode: "weakness-focused" as const, targetTags: ["decimals"] };
    expect(isThemeCategory(input, "decimal")).toBe(true);
    for (const c of ALL_CATEGORIES.filter((c) => c !== "decimal")) {
      expect(isThemeCategory(input, c)).toBe(false);
    }
  });

  it("weakness-focused fractions treats fraction/conversion/mixed-decimal-fraction as theme", () => {
    const input = { mode: "weakness-focused" as const, targetTags: ["fractions"] };
    const theme = ["fraction", "conversion", "mixed-decimal-fraction"] as const;
    for (const c of theme) {
      expect(isThemeCategory(input, c)).toBe(true);
    }
    expect(isThemeCategory(input, "integer")).toBe(false);
    expect(isThemeCategory(input, "decimal")).toBe(false);
    expect(isThemeCategory(input, "power")).toBe(false);
  });

  it("weakness-focused power/absolute-value tags return true for all categories", () => {
    const powerTags = [
      ["square"],
      ["cube"],
      ["square-root"],
      ["absolute-value"],
    ] as const;
    for (const targetTags of powerTags) {
      const input = { mode: "weakness-focused" as const, targetTags: [...targetTags] };
      for (const c of ALL_CATEGORIES) {
        expect(isThemeCategory(input, c)).toBe(true);
      }
    }
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

describe("absoluteValueOperandRange", () => {
  it("widens with difficulty to support calculation practice", () => {
    const easy = absoluteValueOperandRange("easy");
    const extreme = absoluteValueOperandRange("extreme");
    expect(easy.max).toBeGreaterThanOrEqual(20);
    expect(extreme.max).toBeGreaterThan(easy.max);
    expect(extreme.min).toBeGreaterThan(easy.min);
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
