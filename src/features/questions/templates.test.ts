import { describe, expect, it } from "vitest";
import { resolveAnswerPath } from "./answerPath";
import { isSimplestFractionString } from "./fractionMath";
import { costRangeForDifficulty } from "./mentalCost";
import { allTemplates } from "./templates";
import type { Difficulty, Question } from "./types";

describe("multiple-choice options", () => {
  it("always includes the correct answer across all templates", () => {
    const difficulties: Difficulty[] = ["easy", "medium", "hard", "extreme"];

    for (const template of allTemplates) {
      for (const difficulty of difficulties) {
        for (let index = 0; index < 5; index += 1) {
          const question = template({ difficulty, kind: "multiple-choice" });

          expect(question.options).toHaveLength(4);
          expect(new Set(question.options).size).toBe(4);
          expect(question.options).toContain(question.answer);
        }
      }
    }
  });

  it("does not emit long floating-point tails in distractors", () => {
    for (const template of allTemplates) {
      for (let index = 0; index < 10; index += 1) {
        const question = template({ difficulty: "medium", kind: "multiple-choice" });
        for (const option of question.options ?? []) {
          expect(option).not.toMatch(/\d+\.\d{5,}/);
        }
      }
    }
  });
});

describe("resolveAnswerPath", () => {
  it("finalizes rational questions with answer format suffix", () => {
    const difficulties: Difficulty[] = ["easy", "medium", "hard", "extreme"];
    let finalizedCount = 0;

    for (const template of allTemplates) {
      for (const difficulty of difficulties) {
        const range = costRangeForDifficulty(difficulty);

        for (let index = 0; index < 10; index += 1) {
          const draft = template({ difficulty, kind: "fill-in" });
          if (
            !draft.needsAnswerPath ||
            draft.rationalValue === undefined ||
            Number.isInteger(draft.rationalValue)
          ) {
            continue;
          }

          const finalized = resolveAnswerPath(draft, range);
          if (!finalized) {
            continue;
          }

          finalizedCount += 1;
          expect(finalized.needsAnswerPath).toBe(false);
          expect(finalized.prompt).toMatch(/（小數）|（分數）/);
          if (finalized.answerFormat === "fraction") {
            expect(isSimplestFractionString(finalized.answer)).toBe(true);
          } else if (finalized.answerFormat === "decimal") {
            expect(finalized.answer).not.toMatch(/\d+\.\d{5,}/);
          }
        }
      }
    }

    expect(finalizedCount).toBeGreaterThan(0);
  });

  it("keeps a non-terminating rational answer as a simplest fraction (regression: 25/12)", () => {
    const draft: Question = {
      id: "regression",
      kind: "fill-in",
      type: "fractions",
      prompt: "2/3 + 3/4 + 1/2 + 1/6 = ?",
      answer: "25/12",
      difficulty: "medium",
      tags: ["fractions", "addition", "working-memory"],
      needsAnswerPath: true,
      rationalValue: 25 / 12,
      mentalCost: 12,
      costTemplates: [
        { kind: "fraction-unlike-denom", left: { num: 2, den: 3 }, right: { num: 3, den: 4 } },
        { kind: "fraction-unlike-denom", left: { num: 17, den: 12 }, right: { num: 1, den: 2 } },
        { kind: "fraction-unlike-denom", left: { num: 23, den: 12 }, right: { num: 1, den: 6 } },
      ],
      technique: { name: "多步心算", steps: [] },
    };

    const finalized = resolveAnswerPath(draft, { type: "range", min: 0, max: 1000 });

    expect(finalized).toBeDefined();
    expect(finalized!.answerFormat).toBe("fraction");
    expect(finalized!.answer).toBe("25/12");
    expect(isSimplestFractionString(finalized!.answer)).toBe(true);
    expect(finalized!.prompt).toContain("（分數）");
  });
});
