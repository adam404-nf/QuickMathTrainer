import { describe, expect, it } from "vitest";
import { allTemplates } from "./templates";
import type { Difficulty } from "./types";

describe("multiple-choice options", () => {
  it("always includes the correct answer across all templates", () => {
    const difficulties: Difficulty[] = ["easy", "medium", "hard"];

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
});
