import { generateQuestion } from "../questions/registry";
import type { GenerateQuestionInput } from "../questions/types";
import { isAnswerCorrect } from "../questions/utils";
import type { PracticePreferences } from "../settings/types";
import type { Attempt } from "../results/types";
import type { PracticeSession, SubmittedAnswer } from "./types";

function createSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getSeenQuestionIds(attempts: readonly Attempt[], currentQuestionId?: string): Set<string> {
  const ids = attempts.map((attempt) => attempt.questionId);

  if (currentQuestionId) {
    ids.push(currentQuestionId);
  }

  return new Set(ids);
}

function buildGenerateInput(
  preferences: PracticePreferences,
  context: GenerateQuestionInput["context"],
): GenerateQuestionInput {
  return {
    mode: preferences.mode,
    difficulty: preferences.difficulty,
    context,
    targetTags: preferences.mode === "weakness-focused" ? preferences.targetTags : undefined,
    targetTypes: preferences.mode === "weakness-focused" ? preferences.targetTypes : undefined,
    selectedQuestionTypes: preferences.mode === "mixed" ? preferences.selectedQuestionTypes : undefined,
  };
}

export function createPracticeSession(preferences: PracticePreferences): PracticeSession {
  const question = generateQuestion(
    buildGenerateInput(preferences, {
      recentQuestionIds: [],
      seenQuestionIds: new Set(),
    }),
  );

  return {
    id: createSessionId(),
    preferences,
    currentQuestion: question,
    currentIndex: 0,
    attempts: [],
    startedAt: new Date().toISOString(),
    questionStartedAt: performance.now(),
    status: "active",
  };
}

export function submitAnswer(session: PracticeSession, userAnswer: string): SubmittedAnswer {
  const now = performance.now();
  const isCorrect = isAnswerCorrect(userAnswer, session.currentQuestion.answer);
  const attempt: Attempt = {
    id: `${session.id}-attempt-${session.attempts.length + 1}`,
    question: session.currentQuestion,
    questionId: session.currentQuestion.id,
    questionType: session.currentQuestion.type,
    userAnswer,
    correctAnswer: session.currentQuestion.answer,
    isCorrect,
    timeMs: Math.max(0, Math.round(now - session.questionStartedAt)),
    createdAt: new Date().toISOString(),
  };

  return {
    attempt,
    isSessionComplete: session.attempts.length + 1 >= session.preferences.questionLimit,
  };
}

export function advanceSession(session: PracticeSession, attempt: Attempt): PracticeSession {
  const attempts = [...session.attempts, attempt];

  if (attempts.length >= session.preferences.questionLimit) {
    return {
      ...session,
      attempts,
      status: "finished",
    };
  }

  const nextQuestion = generateQuestion(
    buildGenerateInput(session.preferences, {
      recentQuestionIds: attempts.slice(-5).map((item) => item.questionId),
      seenQuestionIds: getSeenQuestionIds(attempts, session.currentQuestion.id),
    }),
  );

  return {
    ...session,
    attempts,
    currentQuestion: nextQuestion,
    currentIndex: session.currentIndex + 1,
    questionStartedAt: performance.now(),
  };
}

export function restartPracticeSession(preferences: PracticePreferences): PracticeSession {
  return createPracticeSession(preferences);
}
