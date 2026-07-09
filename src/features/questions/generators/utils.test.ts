import { afterEach, describe, expect, it, vi } from "vitest";
import * as nonZeroStep from "../nonZeroStep";
import { fractionTemplates } from "../templates";
import { templateWeight } from "../selectionPolicy";
import type { QuestionTemplateDescriptor } from "../templates";
import type { GenerateQuestionInput, Question } from "../types";
import * as questionUtils from "../utils";
import { generateFromTemplates } from "./utils";

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

const zeroStepQuestion: Question = {
  id: "zero-test",
  kind: "fill-in",
  type: "arithmetic",
  prompt: "5 - 5 = ?",
  answer: "0",
  difficulty: "medium",
  tags: ["arithmetic"],
  mentalCost: 12,
  costTemplates: [{ kind: "integer-subtract", a: 5, b: 5 }],
  technique: { name: "test", steps: [] },
};

const zeroTemplate: QuestionTemplateDescriptor = {
  id: "zero-template",
  category: "integer",
  operationKind: "integer-subtract",
  generate: () => zeroStepQuestion,
};

describe("generateFromTemplates zero-step exhaustion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls decideZeroStep with count 8 after exhausting number rerolls", () => {
    const decideSpy = vi.spyOn(nonZeroStep, "decideZeroStep").mockImplementation((params) => {
      if (params.isZero && params.numberRerollCount >= params.maxNumberRerolls) {
        return "reject-template";
      }
      if (params.isZero) {
        return "reroll-numbers";
      }
      return "accept";
    });
    vi.spyOn(questionUtils, "pickWeighted").mockReturnValue(zeroTemplate);

    const result = generateFromTemplates([zeroTemplate], baseInput());

    expect(result).toBeUndefined();
    expect(decideSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        isZero: true,
        numberRerollCount: 8,
        maxNumberRerolls: 8,
      }),
    );
  });

  it("returns question when exhausted zero path accepts per decideZeroStep", () => {
    vi.spyOn(nonZeroStep, "decideZeroStep").mockImplementation((params) => {
      if (params.isZero && params.numberRerollCount >= params.maxNumberRerolls) {
        return "accept";
      }
      if (params.isZero) {
        return "reroll-numbers";
      }
      return "accept";
    });
    vi.spyOn(questionUtils, "pickWeighted").mockReturnValue(zeroTemplate);

    const result = generateFromTemplates([zeroTemplate], baseInput());

    expect(result).toBeDefined();
    expect(result!.answer).toBe("0");
  });
});
