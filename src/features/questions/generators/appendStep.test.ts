import { describe, expect, it, vi } from "vitest";
import { appendCostStep, MAX_APPEND_STEPS } from "./appendStep";
import { tryExtendQuestion } from "./utils";
import { calculateMentalCost } from "../calculationTemplates";
import { costRangeForDifficulty } from "../mentalCost";
import { canAppendOperationKind, operationKindOfSpec } from "../selectionPolicy";
import type { CalculationTemplateSpec } from "../calculationTemplates";
import type { Question } from "../types";

function baseQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: "test",
    kind: "fill-in",
    type: "arithmetic",
    prompt: "3 + 4 = ?",
    answer: "7",
    difficulty: "hard",
    tags: ["addition"],
    mentalCost: 1,
    costTemplates: [{ kind: "integer-add", a: 3, b: 4 }],
    technique: { name: "加法", steps: ["3 + 4 = 7"] },
    ...overrides,
  };
}

describe("appendCostStep", () => {
  it("appends an integer step to a low-cost question", () => {
    const question = baseQuestion();
    const extended = appendCostStep(question);

    expect(extended).toBeDefined();
    expect(extended!.costTemplates!.length).toBeGreaterThan(question.costTemplates!.length);
    expect(extended!.mentalCost).toBeGreaterThan(question.mentalCost);
    expect(extended!.prompt).not.toBe(question.prompt);
  });

  it("keeps appending until the target range is reached", () => {
    const question = baseQuestion({ difficulty: "hard", mentalCost: 1 });
    const bucket = costRangeForDifficulty("hard");
    const extended = tryExtendQuestion(question, {
      mode: "arithmetic",
      difficulty: "hard",
      context: { recentQuestionIds: [], seenQuestionIds: new Set() },
      targetMentalCostBucket: bucket,
    });

    expect(extended.mentalCost).toBeGreaterThanOrEqual(bucket.min);
    expect(extended.mentalCost).toBeLessThanOrEqual(bucket.max);
    expect(extended.costTemplates!.length).toBeGreaterThan(1);
  });

  it("allows more than three appended templates", () => {
    let current = baseQuestion({ difficulty: "easy", mentalCost: 1 });
    let appendCount = 0;

    while (appendCount < MAX_APPEND_STEPS) {
      const next = appendCostStep(current);
      if (!next || next.mentalCost <= current.mentalCost) {
        break;
      }
      current = next;
      appendCount += 1;
    }

    expect(appendCount).toBeGreaterThan(3);
  });
});

describe("same-kind append limit", () => {
  it("allows at most MAX_SAME_KIND_EXTRA extras (total 3)", () => {
    const specs: CalculationTemplateSpec[] = [
      { kind: "integer-add", a: 1, b: 2 },
      { kind: "integer-add", a: 3, b: 4 },
      { kind: "integer-add", a: 5, b: 6 },
    ];
    expect(canAppendOperationKind(specs, "integer-add")).toBe(false);
    expect(canAppendOperationKind(specs.slice(0, 1), "integer-add")).toBe(true);
    expect(canAppendOperationKind(specs.slice(0, 2), "integer-add")).toBe(true);
  });

  it("maps spec kind to operationKind", () => {
    expect(operationKindOfSpec({ kind: "decimal-multiply", decimal: 0.2, integer: 3 })).toBe(
      "decimal-multiply",
    );
  });

  it("blocks same-kind append via appendCostStep when cap is reached", () => {
    const costTemplates: CalculationTemplateSpec[] = [
      { kind: "integer-add", a: 10, b: 2 },
      { kind: "integer-add", a: 8, b: 4 },
      { kind: "integer-add", a: 5, b: 7 },
    ];
    const question = baseQuestion({
      prompt: "12 = ?",
      answer: "12",
      difficulty: "medium",
      costTemplates,
      mentalCost: calculateMentalCost(costTemplates, "12"),
    });

    let extended: Question | undefined;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      extended = appendCostStep(question);
      if (extended) {
        break;
      }
    }

    expect(extended).toBeDefined();
    expect(extended!.costTemplates!.length).toBe(costTemplates.length + 1);
    expect(extended!.costTemplates!.filter((s) => s.kind === "integer-add").length).toBe(3);
    const appended = extended!.costTemplates![extended!.costTemplates!.length - 1];
    expect(appended.kind).not.toBe("integer-add");
  });
});

function weaknessFocusedDecimalsQuestion(): Question {
  const costTemplates: CalculationTemplateSpec[] = [
    { kind: "decimal-add", left: 0.2, right: 0.3 },
  ];
  return baseQuestion({
    type: "fractions",
    prompt: "0.2 + 0.3 = ?",
    answer: "0.5",
    tags: ["decimals", "addition"],
    specialtyTags: ["decimals"],
    costTemplates,
    difficulty: "medium",
    mentalCost: calculateMentalCost(costTemplates, "0.5"),
  });
}

describe("theme-focused append", () => {
  it("appends a decimal step for weakness-focused decimals on fraction-type questions", () => {
    const question = weaknessFocusedDecimalsQuestion();
    const input = {
      mode: "weakness-focused" as const,
      difficulty: "medium" as const,
      targetTags: ["decimals"],
      context: { recentQuestionIds: [], seenQuestionIds: new Set<string>() },
    };

    let extended: Question | undefined;
    for (let i = 0; i < 20; i += 1) {
      extended = appendCostStep(question, input);
      if (extended) {
        break;
      }
    }

    expect(extended).toBeDefined();
    expect(extended!.costTemplates!.length).toBe(question.costTemplates!.length + 1);
    const appended = extended!.costTemplates![extended!.costTemplates!.length - 1];
    expect(appended.kind.startsWith("decimal-")).toBe(true);
  });

  it("prefers theme pool when theme ratio roll succeeds", () => {
    const question = weaknessFocusedDecimalsQuestion();
    const randomSpy = vi.spyOn(Math, "random").mockReturnValueOnce(0.1);

    const extended = appendCostStep(question, {
      mode: "weakness-focused",
      difficulty: "medium",
      targetTags: ["decimals"],
      context: { recentQuestionIds: [], seenQuestionIds: new Set() },
    });

    randomSpy.mockRestore();

    expect(extended).toBeDefined();
    expect(extended!.costTemplates!.length).toBe(question.costTemplates!.length + 1);
    const appended = extended!.costTemplates![extended!.costTemplates!.length - 1];
    expect(appended.kind.startsWith("decimal-")).toBe(true);
  });
});

function fractionsModeQuestion(): Question {
  const costTemplates: CalculationTemplateSpec[] = [
    { kind: "fraction-unlike-denom", left: { num: 1, den: 4 }, right: { num: 1, den: 2 } },
  ];
  return baseQuestion({
    type: "fractions",
    prompt: "1/4 + 1/2 = ?",
    answer: "3/4",
    tags: ["addition"],
    costTemplates,
    difficulty: "medium",
    mentalCost: calculateMentalCost(costTemplates, "3/4"),
  });
}

describe("fractions-mode non-theme append", () => {
  it("can append an integer step when non-theme pool is chosen", () => {
    const question = fractionsModeQuestion();
    const randomSpy = vi.spyOn(Math, "random").mockReturnValueOnce(0.95);

    const extended = appendCostStep(question, {
      mode: "fractions",
      difficulty: "medium",
      context: { recentQuestionIds: [], seenQuestionIds: new Set() },
    });

    randomSpy.mockRestore();

    expect(extended).toBeDefined();
    expect(extended!.costTemplates!.length).toBe(question.costTemplates!.length + 1);
    const appended = extended!.costTemplates![extended!.costTemplates!.length - 1];
    expect(appended.kind.startsWith("integer-")).toBe(true);
  });

  it("prefers theme pool when theme ratio roll succeeds", () => {
    const question = fractionsModeQuestion();
    const randomSpy = vi.spyOn(Math, "random").mockReturnValueOnce(0.1);

    const extended = appendCostStep(question, {
      mode: "fractions",
      difficulty: "medium",
      context: { recentQuestionIds: [], seenQuestionIds: new Set() },
    });

    randomSpy.mockRestore();

    expect(extended).toBeDefined();
    expect(extended!.costTemplates!.length).toBe(question.costTemplates!.length + 1);
    const appended = extended!.costTemplates![extended!.costTemplates!.length - 1];
    expect(appended.kind.startsWith("fraction-")).toBe(true);
  });
});
