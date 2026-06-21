import { describe, expect, it } from "vitest";
import { isAnswerCorrect, normalizeAnswer, parseNumericAnswer } from "./utils";

describe("question answer utilities", () => {
  it("normalizes casing and whitespace", () => {
    expect(normalizeAnswer("  12 /  24 ")).toBe("12/24");
  });

  it("accepts equivalent numeric and fraction answers", () => {
    expect(isAnswerCorrect("0.5", "1/2")).toBe(true);
    expect(isAnswerCorrect(" 42 ", "42")).toBe(true);
  });

  it("rejects non-equivalent answers", () => {
    expect(isAnswerCorrect("0.6", "1/2")).toBe(false);
  });

  it("parses fractions safely", () => {
    expect(parseNumericAnswer("3/4")).toBe(0.75);
    expect(parseNumericAnswer("1/0")).toBeUndefined();
  });
});
