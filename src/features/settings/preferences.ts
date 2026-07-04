import { getQuestionLimitForPreset } from "./sessionLength";
import type { PracticePreferences } from "./types";

export const defaultPracticePreferences: PracticePreferences = {
  mode: "mixed",
  difficulty: "easy",
  sessionLength: "standard",
  questionLimit: getQuestionLimitForPreset("standard"),
  selectedQuestionTypes: ["arithmetic", "powers", "fractions"],
};

export function normalizePracticePreferences(
  preferences: Partial<PracticePreferences> & Pick<PracticePreferences, "mode" | "difficulty">,
): PracticePreferences {
  const sessionLength = preferences.sessionLength ?? "standard";

  return {
    mode: preferences.mode,
    difficulty: preferences.difficulty,
    sessionLength,
    questionLimit: getQuestionLimitForPreset(sessionLength),
    targetTags: preferences.targetTags,
    targetTypes: preferences.targetTypes,
    selectedQuestionTypes: preferences.selectedQuestionTypes ?? defaultPracticePreferences.selectedQuestionTypes,
  };
}
