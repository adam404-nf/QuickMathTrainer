import type { Difficulty, PracticeMode, QuestionType } from "../questions/types";

export interface PracticePreferences {
  mode: PracticeMode;
  difficulty: Difficulty;
  questionLimit: number;
  selectedQuestionTypes: QuestionType[];
}
