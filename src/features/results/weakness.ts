import type { Difficulty, QuestionType } from "../questions/types";
import { getQuestionTypeLabel, getSkillTagLabel } from "../questions/tags";
import type { Attempt } from "./types";

export type WeaknessStatus = "weak" | "insufficient_data" | "ok";

export interface SkillMetric {
  key: string;
  label: string;
  scope: "type" | "tag";
  questionCount: number;
  correctCount: number;
  accuracy: number;
  averageTimeMs: number;
  mistakeCount: number;
  status: WeaknessStatus;
  diagnosis?: string;
}

export interface WeaknessBreakdown {
  byType: SkillMetric[];
  byTag: SkillMetric[];
  weakTypes: SkillMetric[];
  weakTags: SkillMetric[];
  hasInsufficientSample: boolean;
}

interface Thresholds {
  minAccuracy: number;
  maxAverageTimeMs: number;
}

const THRESHOLDS_BY_DIFFICULTY: Record<Difficulty, Thresholds> = {
  easy: { minAccuracy: 0.9, maxAverageTimeMs: 5000 },
  medium: { minAccuracy: 0.8, maxAverageTimeMs: 8000 },
  hard: { minAccuracy: 0.7, maxAverageTimeMs: 12000 },
};

const MIN_SAMPLE_COUNT = 2;

function buildDiagnosis(metric: SkillMetric, thresholds: Thresholds): string | undefined {
  if (metric.status !== "weak") {
    return undefined;
  }

  const lowAccuracy = metric.accuracy < thresholds.minAccuracy;
  const slow = metric.averageTimeMs > thresholds.maxAverageTimeMs;

  if (lowAccuracy && slow) {
    return `${metric.label}正確率與用時都需要加強，建議放慢節奏並重練此類題。`;
  }

  if (lowAccuracy) {
    return `${metric.label}正確率偏低，建議先求穩再求快。`;
  }

  return `${metric.label}正確率尚可，但平均用時偏高，建議練多步心算節奏。`;
}

function aggregateAttempts(
  attempts: readonly Attempt[],
  key: string,
  label: string,
  scope: "type" | "tag",
  difficulty: Difficulty,
): SkillMetric {
  const thresholds = THRESHOLDS_BY_DIFFICULTY[difficulty];
  const questionCount = attempts.length;
  const correctCount = attempts.filter((attempt) => attempt.isCorrect).length;
  const totalTimeMs = attempts.reduce((sum, attempt) => sum + attempt.timeMs, 0);
  const accuracy = questionCount === 0 ? 0 : correctCount / questionCount;
  const averageTimeMs = questionCount === 0 ? 0 : Math.round(totalTimeMs / questionCount);
  const mistakeCount = questionCount - correctCount;

  let status: WeaknessStatus = "ok";

  if (questionCount < MIN_SAMPLE_COUNT) {
    status = "insufficient_data";
  } else if (accuracy < thresholds.minAccuracy || averageTimeMs > thresholds.maxAverageTimeMs) {
    status = "weak";
  }

  const metric: SkillMetric = {
    key,
    label,
    scope,
    questionCount,
    correctCount,
    accuracy,
    averageTimeMs,
    mistakeCount,
    status,
  };

  metric.diagnosis = buildDiagnosis(metric, thresholds);
  return metric;
}

function groupAttemptsByType(attempts: readonly Attempt[]): Map<QuestionType, Attempt[]> {
  const groups = new Map<QuestionType, Attempt[]>();

  for (const attempt of attempts) {
    const current = groups.get(attempt.questionType) ?? [];
    current.push(attempt);
    groups.set(attempt.questionType, current);
  }

  return groups;
}

function groupAttemptsByTag(attempts: readonly Attempt[]): Map<string, Attempt[]> {
  const groups = new Map<string, Attempt[]>();

  for (const attempt of attempts) {
    for (const tag of attempt.question.tags) {
      const current = groups.get(tag) ?? [];
      current.push(attempt);
      groups.set(tag, current);
    }
  }

  return groups;
}

export function createWeaknessBreakdown(
  attempts: readonly Attempt[],
  difficulty: Difficulty,
): WeaknessBreakdown {
  const byType = [...groupAttemptsByType(attempts).entries()]
    .map(([type, groupedAttempts]) =>
      aggregateAttempts(groupedAttempts, type, getQuestionTypeLabel(type), "type", difficulty),
    )
    .sort((left, right) => left.accuracy - right.accuracy || right.averageTimeMs - left.averageTimeMs);

  const byTag = [...groupAttemptsByTag(attempts).entries()]
    .map(([tag, groupedAttempts]) =>
      aggregateAttempts(groupedAttempts, tag, getSkillTagLabel(tag), "tag", difficulty),
    )
    .sort((left, right) => left.accuracy - right.accuracy || right.averageTimeMs - left.averageTimeMs);

  const weakTypes = byType.filter((metric) => metric.status === "weak");
  const weakTags = byTag.filter((metric) => metric.status === "weak");
  const hasInsufficientSample =
    attempts.length < MIN_SAMPLE_COUNT ||
    byTag.some((metric) => metric.status === "insufficient_data") ||
    weakTags.length === 0 && weakTypes.length === 0;

  return {
    byType,
    byTag,
    weakTypes,
    weakTags,
    hasInsufficientSample,
  };
}

export function getWeaknessTargetTags(breakdown: WeaknessBreakdown, limit = 3): string[] {
  return breakdown.weakTags.slice(0, limit).map((metric) => metric.key);
}

export function getWeaknessTargetTypes(breakdown: WeaknessBreakdown, limit = 3): QuestionType[] {
  return breakdown.weakTypes.slice(0, limit).map((metric) => metric.key as QuestionType);
}
