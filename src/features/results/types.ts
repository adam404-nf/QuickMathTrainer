import type { Difficulty, PracticeMode, Question, QuestionType } from "../questions/types";

export interface Attempt {
  id: string;
  question: Question;
  questionId: string;
  questionType: QuestionType;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  timeMs: number;
  createdAt: string;
}

export interface SessionSummary {
  totalQuestions: number;
  correctCount: number;
  accuracy: number;
  averageTimeMs: number;
  mistakes: Attempt[];
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
