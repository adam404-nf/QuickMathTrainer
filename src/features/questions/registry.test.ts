import { describe, expect, it } from "vitest";
import {
  classifyCostBand,
  costRangeForDifficulty,
  DIFFICULTY_COST_DISTRIBUTIONS,
  matchesMentalCostBucket,
  maxQuestionsPerType,
} from "./mentalCost";
import { availableQuestionTypes, generateQuestion, questionMatchesTargets } from "./registry";
import type { QuestionType } from "./types";

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

  it("keeps each type-and-difficulty distribution within ±5%", () => {
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
          expect(actualRatio).toBeGreaterThanOrEqual(expectedRatio - 0.05);
          expect(actualRatio).toBeLessThanOrEqual(expectedRatio + 0.05);
        });
      }
    }
  }, 120_000);

  it("caps per-type question counts in mixed sessions", () => {
    const questionLimit = 10;
    const cap = maxQuestionsPerType(questionLimit, availableQuestionTypes.length);
    const typeCounts: Partial<Record<QuestionType, number>> = { fractions: cap };

    for (let index = 0; index < 20; index += 1) {
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

      expect(question.type).not.toBe("fractions");
    }
  }, 120_000);

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
