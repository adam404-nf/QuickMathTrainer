import { describe, expect, it } from "vitest";
import { availableQuestionTypes, generateQuestion, questionMatchesTargets } from "./registry";

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

  it("targets weighted mentalCost buckets per difficulty", () => {
    const sample = (difficulty: "easy" | "medium" | "hard", count: number) => {
      const costs: number[] = [];
      for (let index = 0; index < count; index += 1) {
        const question = generateQuestion({
          mode: "mixed",
          difficulty,
          context: {
            recentQuestionIds: [],
            seenQuestionIds: new Set(),
          },
        });
        costs.push(question.mentalCost);
      }
      return costs;
    };

    const easy = sample("easy", 80);
    const medium = sample("medium", 80);
    const hard = sample("hard", 80);

    expect(easy.filter((cost) => cost === 5 || cost === 6).length).toBeGreaterThan(40);
    expect(medium.filter((cost) => cost === 8 || cost === 9).length).toBeGreaterThan(45);
    expect(hard.filter((cost) => cost === 10 || cost === 11).length).toBeGreaterThan(50);
  });

  it("can generate absolute-value questions across practice modes", () => {
    const modes = [
      { mode: "arithmetic" as const, difficulty: "medium" as const },
      { mode: "fractions" as const, difficulty: "medium" as const },
      { mode: "mixed" as const, difficulty: "hard" as const },
    ];

    for (const config of modes) {
      let found = false;

      for (let index = 0; index < 40; index += 1) {
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
  });
});
