import type { Attempt } from "../results/types";
import type { Question } from "../questions/types";
import type { PracticeSession } from "./types";

export interface PracticeViewState {
  question: Question;
  attempt: Attempt | undefined;
  isReviewing: boolean;
}

export function getPracticeViewState(
  session: PracticeSession,
  viewIndex: number,
  latestAttempt: Attempt | undefined,
): PracticeViewState {
  const isCurrentSlot = viewIndex === session.currentIndex;

  if (!isCurrentSlot) {
    const attempt = session.attempts[viewIndex];

    return {
      question: attempt.question,
      attempt,
      isReviewing: true,
    };
  }

  return {
    question: session.currentQuestion,
    attempt: latestAttempt,
    isReviewing: false,
  };
}
