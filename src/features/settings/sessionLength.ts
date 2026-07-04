import type { SessionLengthPreset } from "./types";

export const SESSION_LENGTH_LIMITS: Record<SessionLengthPreset, number> = {
  short: 10,
  standard: 20,
  intensive: 50,
};

export const SESSION_LENGTH_LABELS: Record<SessionLengthPreset, string> = {
  short: "低檔 · 10 題",
  standard: "中檔 · 20 題",
  intensive: "高檔 · 50 題",
};

export function getQuestionLimitForPreset(preset: SessionLengthPreset): number {
  return SESSION_LENGTH_LIMITS[preset];
}

export function inferPresetFromQuestionLimit(questionLimit: number): SessionLengthPreset {
  if (questionLimit >= SESSION_LENGTH_LIMITS.intensive) {
    return "intensive";
  }

  if (questionLimit >= SESSION_LENGTH_LIMITS.standard) {
    return "standard";
  }

  return "short";
}
