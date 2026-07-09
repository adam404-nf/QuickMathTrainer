import { describe, expect, it } from "vitest";
import { fractionTemplates } from "../templates";
import { templateWeight } from "../selectionPolicy";
import type { GenerateQuestionInput } from "../types";

const baseInput = (overrides: Partial<GenerateQuestionInput> = {}): GenerateQuestionInput => ({
  mode: "mixed",
  difficulty: "medium",
  context: { recentQuestionIds: [], seenQuestionIds: new Set() },
  ...overrides,
});

describe("templateWeight", () => {
  it("keeps decimal and fraction templates selectable in fractions mode", () => {
    const decimal = fractionTemplates.find((t) => t.category === "decimal")!;
    const fraction = fractionTemplates.find((t) => t.category === "fraction")!;
    expect(decimal).toBeDefined();
    expect(fraction).toBeDefined();
    expect(templateWeight(baseInput({ mode: "fractions" }), decimal)).toBeGreaterThan(0);
    expect(templateWeight(baseInput({ mode: "fractions" }), fraction)).toBeGreaterThan(0);
  });

  it("boosts theme templates for weakness-focused decimals", () => {
    const decimal = fractionTemplates.find((t) => t.category === "decimal")!;
    const fraction = fractionTemplates.find((t) => t.category === "fraction")!;
    const input = baseInput({ mode: "weakness-focused", targetTags: ["decimals"] });
    expect(templateWeight(input, decimal)).toBeGreaterThan(templateWeight(input, fraction));
  });

  it("keeps conversion weight independent of decimal cap logic", () => {
    const conversion = fractionTemplates.find((t) => t.category === "conversion")!;
    expect(conversion).toBeDefined();
    expect(templateWeight(baseInput({ mode: "mixed" }), conversion)).toBeGreaterThan(0);
  });
});
