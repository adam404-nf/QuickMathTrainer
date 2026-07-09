import { describe, expect, it } from "vitest";
import { resultForTemplate } from "./calculationTemplates";
import {
  classifyCostBand,
  costRangeForDifficulty,
  DIFFICULTY_COST_DISTRIBUTIONS,
  matchesMentalCostBucket,
  maxQuestionsPerType,
} from "./mentalCost";
import { isZeroStepResult } from "./nonZeroStep";
import { availableQuestionTypes, applySessionQuestionsToContext, generateQuestion, questionMatchesTargets, updateQuestionContextAfterGenerate } from "./registry";
import {
  isDecimalTemplateCategory,
  isHardTemplateCategory,
  mixedHardTemplateTarget,
  questionTypeWeight,
  type TemplateCategory,
} from "./selectionPolicy";
import type { QuestionType } from "./types";

function categoryOf(q: { templateCategory?: TemplateCategory }): TemplateCategory {
  if (!q.templateCategory) {
    throw new Error("question missing templateCategory metadata");
  }
  return q.templateCategory;
}

describe("question registry", () => {
  it("exposes the first MVP generator group", () => {
    expect(availableQuestionTypes).toEqual(["arithmetic", "fractions", "powers"]);
  });

  it("generates a valid mixed practice question", () => {
    const question = generateQuestion({
      mode: "mixed",
      difficulty: "easy",
      context: {
        recentQuestionIds: [],
        seenQuestionIds: new Set(),
      },
    });

    expect(question.prompt).toContain("?");
    expect(question.answer).not.toHaveLength(0);
    expect(availableQuestionTypes).toContain(question.type);
  });

  it("generates multi-step templates with diagnostic tags", () => {
    let foundMultiStep = false;

    for (let index = 0; index < 40; index += 1) {
      const question = generateQuestion({
        mode: "mixed",
        difficulty: "medium",
        context: {
          recentQuestionIds: [],
          seenQuestionIds: new Set(),
        },
      });

      if (question.tags.includes("order-of-operations")) {
        foundMultiStep = true;
        break;
      }
    }

    expect(foundMultiStep).toBe(true);
  });

  it("prefers questions that match weakness-focused target tags", () => {
    let matched = 0;

    for (let index = 0; index < 20; index += 1) {
      const question = generateQuestion({
        mode: "weakness-focused",
        difficulty: "easy",
        targetTags: ["absolute-value"],
        context: {
          recentQuestionIds: [],
          seenQuestionIds: new Set(),
        },
      });

      if (questionMatchesTargets(question, ["absolute-value"])) {
        matched += 1;
      }
    }

    expect(matched).toBeGreaterThan(0);
  });

  it("keeps weakness-focused sessions on decimal tags instead of falling back to integers", () => {
    let matched = 0;

    for (let index = 0; index < 30; index += 1) {
      const question = generateQuestion({
        mode: "weakness-focused",
        difficulty: "medium",
        targetTags: ["decimals"],
        targetTypes: ["arithmetic", "fractions"],
        context: {
          recentQuestionIds: [],
          seenQuestionIds: new Set(),
        },
      });

      if (questionMatchesTargets(question, ["decimals"])) {
        matched += 1;
      }
    }

    expect(matched).toBe(30);
  });

  it("keeps weakness-focused addition sessions off cube-root specialty questions", () => {
    for (let index = 0; index < 20; index += 1) {
      const question = generateQuestion({
        mode: "weakness-focused",
        difficulty: "medium",
        targetTags: ["addition"],
        context: {
          recentQuestionIds: [],
          seenQuestionIds: new Set(),
        },
      });

      expect(question.specialtyTags?.includes("cube-root") ?? false).toBe(false);
    }
  });

  it("generates multi-step templates in easy mixed practice", () => {
    let foundMultiStep = false;

    for (let index = 0; index < 40; index += 1) {
      const question = generateQuestion({
        mode: "mixed",
        difficulty: "easy",
        context: {
          recentQuestionIds: [],
          seenQuestionIds: new Set(),
        },
      });

      if (question.tags.includes("order-of-operations")) {
        foundMultiStep = true;
        break;
      }
    }

    expect(foundMultiStep).toBe(true);
  });

  it("limits mixed mode to selected question types when provided", () => {
    for (let index = 0; index < 20; index += 1) {
      const question = generateQuestion({
        mode: "mixed",
        difficulty: "easy",
        selectedQuestionTypes: ["arithmetic", "fractions"],
        context: {
          recentQuestionIds: [],
          seenQuestionIds: new Set(),
        },
      });

      expect(["arithmetic", "fractions"]).toContain(question.type);
    }
  });

  it("can generate powers prompts with cube, fourth power, and higher roots", () => {
    const prompts = new Set<string>();

    for (let index = 0; index < 120; index += 1) {
      const question = generateQuestion({
        mode: "powers",
        difficulty: "hard",
        context: {
          recentQuestionIds: [],
          seenQuestionIds: new Set(),
        },
      });

      prompts.add(question.prompt);
    }

    expect([...prompts].some((prompt) => prompt.includes("³"))).toBe(true);
    expect([...prompts].some((prompt) => prompt.includes("⁴"))).toBe(true);
    expect([...prompts].some((prompt) => prompt.includes("∛"))).toBe(true);
    expect([...prompts].some((prompt) => prompt.includes("⁴√"))).toBe(true);
  });

  it("every mode and difficulty stays strictly in the global range", () => {
    const modes = ["arithmetic", "fractions", "powers", "mixed"] as const;
    const difficulties = ["easy", "medium", "hard", "extreme"] as const;

    for (const mode of modes) {
      for (const difficulty of difficulties) {
        const range = costRangeForDifficulty(difficulty);
        for (let index = 0; index < 40; index += 1) {
          const question = generateQuestion({
            mode,
            difficulty,
            context: {
              recentQuestionIds: [],
              seenQuestionIds: new Set(),
            },
          });

          expect(matchesMentalCostBucket(question.mentalCost, range)).toBe(true);
        }
      }
    }
  }, 120_000);

  it("keeps each type-and-difficulty distribution within ±15%", () => {
    const modes = ["arithmetic", "fractions", "powers"] as const;
    const difficulties = ["easy", "medium", "hard", "extreme"] as const;

    for (const mode of modes) {
      for (const difficulty of difficulties) {
        const bands = DIFFICULTY_COST_DISTRIBUTIONS[difficulty];
        const totalWeight = bands.reduce((sum, band) => sum + band.weight, 0);
        const counts = new Array(bands.length).fill(0);
        const sampleCount = 800;

        for (let index = 0; index < sampleCount; index += 1) {
          const question = generateQuestion({
            mode,
            difficulty,
            context: {
              recentQuestionIds: [],
              seenQuestionIds: new Set(),
            },
          });
          const bandIndex = classifyCostBand(difficulty, question.mentalCost);
          expect(bandIndex).toBeGreaterThanOrEqual(0);
          counts[bandIndex] += 1;
        }

        counts.forEach((count, bandIndex) => {
          const actualRatio = count / sampleCount;
          const expectedRatio = bands[bandIndex].weight / totalWeight;
          expect(actualRatio).toBeGreaterThanOrEqual(expectedRatio - 0.15);
          expect(actualRatio).toBeLessThanOrEqual(expectedRatio + 0.15);
        });
      }
    }
  }, 120_000);

  it("soft quota mostly deprioritizes over-cap types in mixed sessions", () => {
    const questionLimit = 10;
    const cap = maxQuestionsPerType(questionLimit, availableQuestionTypes.length);
    const typeCounts: Partial<Record<QuestionType, number>> = { fractions: cap };
    const trials = 100;

    let fractionCount = 0;

    for (let index = 0; index < trials; index += 1) {
      const question = generateQuestion({
        mode: "mixed",
        difficulty: "hard",
        context: {
          recentQuestionIds: [],
          seenQuestionIds: new Set(),
          typeCounts,
          questionLimit,
        },
      });

      if (question.type === "fractions") {
        fractionCount += 1;
      }
    }

    // Soft quota (0.15× penalty): over-cap types remain possible but are mostly avoided
    expect(fractionCount / trials).toBeLessThanOrEqual(0.35);
  }, 120_000);

  it("accumulates recentDecimalRatio across session context updates", () => {
    let context = {
      recentQuestionIds: [] as string[],
      seenQuestionIds: new Set<string>(),
    };
    let decimalCount = 0;

    for (let index = 0; index < 40; index += 1) {
      const question = generateQuestion({
        mode: "mixed",
        difficulty: "medium",
        context,
      });
      if (isDecimalTemplateCategory(categoryOf(question))) {
        decimalCount += 1;
      }
      context = updateQuestionContextAfterGenerate(context, question);
    }

    expect(context.recentDecimalRatio).toBeCloseTo(decimalCount / 40, 5);
    expect(context.sessionPrimaryCount).toBe(40);
  }, 120_000);

  it("applySessionQuestionsToContext matches sequential updates", () => {
    const questions = Array.from({ length: 5 }, () =>
      generateQuestion({
        mode: "mixed",
        difficulty: "easy",
        context: { recentQuestionIds: [], seenQuestionIds: new Set() },
      }),
    );

    let sequential = { recentQuestionIds: [], seenQuestionIds: new Set<string>() };
    for (const question of questions) {
      sequential = updateQuestionContextAfterGenerate(sequential, question);
    }

    const batched = applySessionQuestionsToContext(
      { recentQuestionIds: [], seenQuestionIds: new Set() },
      questions,
    );

    expect(batched.recentDecimalRatio).toBe(sequential.recentDecimalRatio);
    expect(batched.sessionPrimaryCount).toBe(sequential.sessionPrimaryCount);
  });

  it("can generate absolute-value questions across practice modes", () => {
    const modes = [
      { mode: "arithmetic" as const, difficulty: "medium" as const },
      { mode: "fractions" as const, difficulty: "medium" as const },
      { mode: "mixed" as const, difficulty: "hard" as const },
    ];

    for (const config of modes) {
      let found = false;

      for (let index = 0; index < 120; index += 1) {
        const question = generateQuestion({
          mode: config.mode,
          difficulty: config.difficulty,
          context: {
            recentQuestionIds: [],
            seenQuestionIds: new Set(),
          },
        });

        if (question.tags.includes("absolute-value")) {
          found = true;
          break;
        }
      }

      expect(found).toBe(true);
    }
  }, 30_000);
});

describe("registry selectionPolicy integration", () => {
  it("weights mixed extreme toward fractions/powers over arithmetic", () => {
    const input = {
      mode: "mixed" as const,
      difficulty: "extreme" as const,
      context: { recentQuestionIds: [], seenQuestionIds: new Set<string>() },
    };
    const a = questionTypeWeight(input, "arithmetic");
    const f = questionTypeWeight(input, "fractions");
    const p = questionTypeWeight(input, "powers");
    expect(f + p).toBeGreaterThan(a);
  });

  it("never returns out-of-range cost even when generation is difficult", () => {
    const range = costRangeForDifficulty("hard");
    for (let i = 0; i < 30; i += 1) {
      const q = generateQuestion({
        mode: "mixed",
        difficulty: "hard",
        context: { recentQuestionIds: [], seenQuestionIds: new Set() },
      });
      expect(matchesMentalCostBucket(q.mentalCost, range)).toBe(true);
    }
  });
});

describe("selectionPolicy Monte Carlo", () => {
  it("keeps mixed decimal primary templates near 10%", () => {
    const n = 1000;
    let decimal = 0;
    for (let i = 0; i < n; i += 1) {
      const q = generateQuestion({
        mode: "mixed",
        difficulty: "medium",
        context: { recentQuestionIds: [], seenQuestionIds: new Set() },
      });
      if (isDecimalTemplateCategory(categoryOf(q))) decimal += 1;
    }
    const ratio = decimal / n;
    expect(ratio).toBeGreaterThanOrEqual(0.05);
    expect(ratio).toBeLessThanOrEqual(0.15);
  }, 120_000);

  it("keeps fractions specialty decimal primaries near 20%", () => {
    const n = 1000;
    let decimal = 0;
    for (let i = 0; i < n; i += 1) {
      const q = generateQuestion({
        mode: "fractions",
        difficulty: "medium",
        context: { recentQuestionIds: [], seenQuestionIds: new Set() },
      });
      if (isDecimalTemplateCategory(categoryOf(q))) decimal += 1;
    }
    const ratio = decimal / n;
    expect(ratio).toBeGreaterThanOrEqual(0.14);
    expect(ratio).toBeLessThanOrEqual(0.26);
  }, 120_000);

  it("hard-excludes non-integer categories in arithmetic mode", () => {
    for (let i = 0; i < 500; i += 1) {
      const q = generateQuestion({
        mode: "arithmetic",
        difficulty: "medium",
        context: { recentQuestionIds: [], seenQuestionIds: new Set() },
      });
      expect(categoryOf(q)).toBe("integer");
      expect(q.type).toBe("arithmetic");
      for (const spec of q.costTemplates ?? []) {
        expect(spec.kind.startsWith("fraction")).toBe(false);
        expect(spec.kind.startsWith("decimal")).toBe(false);
        expect(spec.kind.includes("decimal-fraction")).toBe(false);
      }
    }
  }, 120_000);

  it("hard-excludes power category in fractions mode", () => {
    for (let i = 0; i < 500; i += 1) {
      const q = generateQuestion({
        mode: "fractions",
        difficulty: "hard",
        context: { recentQuestionIds: [], seenQuestionIds: new Set() },
      });
      expect(categoryOf(q)).not.toBe("power");
      expect(q.type).not.toBe("powers");
    }
  }, 120_000);

  it("matches mixed hard-template totals by difficulty", () => {
    for (const difficulty of ["easy", "medium", "hard", "extreme"] as const) {
      const target = mixedHardTemplateTarget(difficulty);
      const n = 1000;
      let hard = 0;
      for (let i = 0; i < n; i += 1) {
        const q = generateQuestion({
          mode: "mixed",
          difficulty,
          context: { recentQuestionIds: [], seenQuestionIds: new Set() },
        });
        if (isHardTemplateCategory(categoryOf(q))) hard += 1;
      }
      const ratio = hard / n;
      expect(ratio).toBeGreaterThanOrEqual(target - 0.08);
      expect(ratio).toBeLessThanOrEqual(target + 0.08);
    }
  }, 300_000);

  it("keeps weakness decimals highly focused and above 10% decimal cap", () => {
    const n = 300;
    let matched = 0;
    let decimalPrimary = 0;
    for (let i = 0; i < n; i += 1) {
      const q = generateQuestion({
        mode: "weakness-focused",
        difficulty: "medium",
        targetTags: ["decimals"],
        targetTypes: ["arithmetic", "fractions"],
        context: { recentQuestionIds: [], seenQuestionIds: new Set() },
      });
      if (questionMatchesTargets(q, ["decimals"])) matched += 1;
      if (isDecimalTemplateCategory(categoryOf(q))) decimalPrimary += 1;
    }
    expect(matched / n).toBeGreaterThanOrEqual(0.6);
    expect(decimalPrimary / n).toBeGreaterThan(0.2);
  }, 120_000);

  it("keeps step intermediate zeros near 2%", () => {
    let steps = 0;
    let zeros = 0;
    for (let i = 0; i < 400; i += 1) {
      const q = generateQuestion({
        mode: "mixed",
        difficulty: "medium",
        context: { recentQuestionIds: [], seenQuestionIds: new Set() },
      });
      for (const spec of q.costTemplates ?? []) {
        steps += 1;
        if (isZeroStepResult(resultForTemplate(spec))) zeros += 1;
      }
    }
    expect(steps).toBeGreaterThan(500);
    const ratio = zeros / steps;
    expect(ratio).toBeGreaterThanOrEqual(0);
    expect(ratio).toBeLessThanOrEqual(0.04);
  }, 120_000);

  it("keeps specialty theme step ratio near 70% for fractions mode", () => {
    let theme = 0;
    let total = 0;
    for (let i = 0; i < 400; i += 1) {
      const q = generateQuestion({
        mode: "fractions",
        difficulty: "medium",
        context: { recentQuestionIds: [], seenQuestionIds: new Set() },
      });
      for (const spec of q.costTemplates ?? []) {
        total += 1;
        const kind = spec.kind;
        const isTheme =
          kind.startsWith("fraction") ||
          kind.startsWith("decimal") ||
          kind.includes("decimal-fraction");
        if (isTheme) theme += 1;
      }
    }
    const ratio = theme / total;
    expect(ratio).toBeGreaterThanOrEqual(0.6);
    expect(ratio).toBeLessThanOrEqual(0.8);
  }, 120_000);
});
