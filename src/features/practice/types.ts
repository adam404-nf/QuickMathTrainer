import type { Question } from "../questions/types";
import type { Attempt } from "../results/types";
import type { PracticePreferences } from "../settings/types";

export type PracticeSessionStatus = "active" | "finished";

export interface PracticeSession {
  id: string;
  preferences: PracticePreferences;
  currentQuestion: Question;
  currentIndex: number;
  attempts: Attempt[];
  startedAt: string;
  questionStartedAt: number;
  status: PracticeSessionStatus;
}

export interface SubmittedAnswer {
  attempt: Attempt;
  isSessionComplete: boolean;
}
