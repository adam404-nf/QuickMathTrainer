import type { PracticePreferences } from "./types";

export const defaultPracticePreferences: PracticePreferences = {
  mode: "mixed",
  difficulty: "easy",
  questionLimit: 10,
  selectedQuestionTypes: ["arithmetic", "powers", "fractions"],
};
