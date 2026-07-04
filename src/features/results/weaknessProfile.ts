import type { Difficulty, QuestionType } from "../questions/types";
import {
  createWeaknessBreakdown,
  getWeaknessTargetTags,
  getWeaknessTargetTypes,
  type WeaknessBreakdown,
} from "./weakness";
import type { PracticeHistoryEntry } from "./types";

const MIN_HISTORY_ATTEMPTS = 10;
const MAX_SESSIONS = 5;
const MAX_ATTEMPTS = 50;

export interface WeaknessTargets {
  tags: string[];
  types: QuestionType[];
  totalAttempts: number;
  isReady: boolean;
  message?: string;
}

function collectRecentAttempts(history: readonly PracticeHistoryEntry[]): {
  attempts: PracticeHistoryEntry["attempts"];
  difficulty: Difficulty;
} {
  const recentSessions = history.slice(0, MAX_SESSIONS);
  const attempts = recentSessions.flatMap((entry) => entry.attempts).slice(0, MAX_ATTEMPTS);
  const difficulty = recentSessions[0]?.difficulty ?? "medium";

  return { attempts, difficulty };
}

export interface WeaknessBreakdownResult {
  breakdown: WeaknessBreakdown;
  totalAttempts: number;
  isReady: boolean;
  message?: string;
}

export function deriveWeaknessBreakdownFromHistory(
  history: readonly PracticeHistoryEntry[],
  difficulty: Difficulty = history[0]?.difficulty ?? "medium",
): WeaknessBreakdownResult {
  const { attempts, difficulty: derivedDifficulty } = collectRecentAttempts(history);
  const effectiveDifficulty = history.length > 0 ? derivedDifficulty : difficulty;

  if (attempts.length < MIN_HISTORY_ATTEMPTS) {
    return {
      breakdown: createWeaknessBreakdown([], effectiveDifficulty),
      totalAttempts: attempts.length,
      isReady: false,
      message: "先完成幾輪混合練習，再使用弱項專攻。",
    };
  }

  const breakdown = createWeaknessBreakdown(attempts, effectiveDifficulty);
  const hasWeakItems = breakdown.weakTags.length > 0 || breakdown.weakTypes.length > 0;

  if (!hasWeakItems) {
    return {
      breakdown,
      totalAttempts: attempts.length,
      isReady: false,
      message: "目前沒有明顯弱項，建議繼續混合練習。",
    };
  }

  return {
    breakdown,
    totalAttempts: attempts.length,
    isReady: true,
  };
}

export function deriveWeaknessTargets(
  history: readonly PracticeHistoryEntry[],
  difficulty: Difficulty = history[0]?.difficulty ?? "medium",
): WeaknessTargets {
  const { attempts, difficulty: derivedDifficulty } = collectRecentAttempts(history);
  const effectiveDifficulty = history.length > 0 ? derivedDifficulty : difficulty;

  if (attempts.length < MIN_HISTORY_ATTEMPTS) {
    return {
      tags: [],
      types: [],
      totalAttempts: attempts.length,
      isReady: false,
      message: "先完成幾輪混合練習，再使用弱項專攻。",
    };
  }

  const breakdown = createWeaknessBreakdown(attempts, effectiveDifficulty);
  const tags = getWeaknessTargetTags(breakdown, 3);
  const types = getWeaknessTargetTypes(breakdown, 3);

  if (tags.length === 0 && types.length === 0) {
    return {
      tags: [],
      types: [],
      totalAttempts: attempts.length,
      isReady: false,
      message: "目前沒有明顯弱項，建議繼續混合練習。",
    };
  }

  return {
    tags,
    types,
    totalAttempts: attempts.length,
    isReady: true,
  };
}
