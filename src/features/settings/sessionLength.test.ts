import { describe, expect, it } from "vitest";
import {
  SESSION_LENGTH_LIMITS,
  getQuestionLimitForPreset,
  inferPresetFromQuestionLimit,
} from "./sessionLength";

describe("session length presets", () => {
  it("maps presets to 10, 20, and 50 questions", () => {
    expect(SESSION_LENGTH_LIMITS.short).toBe(10);
    expect(SESSION_LENGTH_LIMITS.standard).toBe(20);
    expect(SESSION_LENGTH_LIMITS.intensive).toBe(50);
    expect(getQuestionLimitForPreset("standard")).toBe(20);
  });

  it("infers preset from legacy question limits", () => {
    expect(inferPresetFromQuestionLimit(5)).toBe("short");
    expect(inferPresetFromQuestionLimit(10)).toBe("short");
    expect(inferPresetFromQuestionLimit(20)).toBe("standard");
    expect(inferPresetFromQuestionLimit(50)).toBe("intensive");
  });
});
