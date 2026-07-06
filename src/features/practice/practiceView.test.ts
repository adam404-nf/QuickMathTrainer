import { describe, expect, it } from "vitest";
import { getPracticeViewState } from "./practiceView";
import { createPracticeSession, revealAnswer, submitAnswer } from "./session";
import { defaultPracticePreferences } from "../settings/preferences";

describe("getPracticeViewState", () => {
  it("returns the current question when viewing the active slot", () => {
    const session = createPracticeSession(defaultPracticePreferences);

    const viewState = getPracticeViewState(session, 0, undefined);

    expect(viewState.question).toBe(session.currentQuestion);
    expect(viewState.attempt).toBeUndefined();
    expect(viewState.isReviewing).toBe(false);
  });

  it("returns a saved attempt when reviewing a previous question", () => {
    const session = createPracticeSession(defaultPracticePreferences);
    const firstAttempt = submitAnswer(session, "1").attempt;
    const advanced = {
      ...session,
      attempts: [firstAttempt],
      currentIndex: 1,
      currentQuestion: {
        ...session.currentQuestion,
        id: "question-2",
        prompt: "2 + 2 = ?",
      },
    };

    const viewState = getPracticeViewState(advanced, 0, undefined);

    expect(viewState.question).toBe(firstAttempt.question);
    expect(viewState.attempt).toBe(firstAttempt);
    expect(viewState.isReviewing).toBe(true);
  });
});

describe("revealAnswer", () => {
  it("marks the attempt as revealed and incorrect", () => {
    const session = createPracticeSession(defaultPracticePreferences);
    const result = revealAnswer(session);

    expect(result.attempt.revealed).toBe(true);
    expect(result.attempt.isCorrect).toBe(false);
    expect(result.attempt.userAnswer).toBe("");
  });
});
