import { describe, expect, it } from "vitest";
import { getAnswerFormatHint, isAnswerCorrect, normalizeAnswer, parseNumericAnswer } from "./utils";

describe("question answer utilities", () => {
  it("normalizes casing and whitespace", () => {
    expect(normalizeAnswer("  12 /  24 ")).toBe("12/24");
  });

  it("accepts exact integer answers", () => {
    expect(isAnswerCorrect(" 42 ", "42")).toBe(true);
  });

  it("rejects cross-format equivalent answers when answerFormat is set", () => {
    expect(isAnswerCorrect("0.5", "1/2", "fraction")).toBe(false);
    expect(isAnswerCorrect("3/4", "0.75", "decimal")).toBe(false);
    expect(isAnswerCorrect("2/4", "1/2", "fraction")).toBe(false);
    expect(isAnswerCorrect("0.75", "0.75", "decimal")).toBe(true);
  });

  it("rejects non-equivalent answers", () => {
    expect(isAnswerCorrect("0.6", "1/2", "fraction")).toBe(false);
  });

  it("parses fractions safely", () => {
    expect(parseNumericAnswer("3/4")).toBe(0.75);
    expect(parseNumericAnswer("1/0")).toBeUndefined();
  });

  it("accepts fixed-format absolute-value symbolic answers only", () => {
    expect(isAnswerCorrect("|a|", "|a|")).toBe(true);
    expect(isAnswerCorrect("|A|", "|a|")).toBe(true);
    expect(isAnswerCorrect("a", "|a|")).toBe(false);
    expect(isAnswerCorrect("abs(a)", "|a|")).toBe(false);
  });

  it("describes the expected answer format for fill-in hints", () => {
    expect(getAnswerFormatHint("42")).toBe("請輸入整數");
    expect(getAnswerFormatHint("-7")).toBe("請輸入整數");
    expect(getAnswerFormatHint("3/4", "fraction")).toBe("請以最簡分數作答（例如 3/4）");
    expect(getAnswerFormatHint("0.5", "decimal")).toBe("請輸入小數（例如 0.5）");
    expect(getAnswerFormatHint("3/4")).toBe("請以分數形式作答（例如 3/4）");
    expect(getAnswerFormatHint("0.5")).toBe("請輸入小數（例如 0.5）");
    expect(getAnswerFormatHint("|x|")).toBe("請以絕對值形式作答（例如 |x|）");
  });
});
