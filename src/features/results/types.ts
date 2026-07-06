import type { Difficulty, PracticeMode, Question, QuestionType } from "../questions/types";
import type { WeaknessBreakdown } from "./weakness";

export interface Attempt {
  id: string;
  question: Question;
  questionId: string;
  questionType: QuestionType;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  revealed?: boolean;
  timeMs: number;
  createdAt: string;
}

export interface SessionSummary {
  totalQuestions: number;
  correctCount: number;
  accuracy: number;
  averageTimeMs: number;
  mistakes: Attempt[];
  weakness: WeaknessBreakdown;
}

export interface PracticeHistoryEntry {
  id: string;
  mode: PracticeMode;
  difficulty: Difficulty;
  startedAt: string;
  endedAt: string;
  attempts: Attempt[];
  summary: SessionSummary;
}
