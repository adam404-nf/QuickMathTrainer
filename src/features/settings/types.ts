import type { Difficulty, PracticeMode, QuestionType } from "../questions/types";

export type SessionLengthPreset = "short" | "standard" | "intensive";

export interface PracticePreferences {
  mode: PracticeMode;
  difficulty: Difficulty;
  sessionLength: SessionLengthPreset;
  questionLimit: number;
  targetTags?: string[];
  targetTypes?: QuestionType[];
  selectedQuestionTypes: QuestionType[];
}
