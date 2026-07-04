import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { getQuizPreferences, getQuickPracticePreferences, HomePage } from "../../app/components/HomePage";
import { defaultPracticePreferences } from "../../features/settings/preferences";

describe("HomePage", () => {
  it("starts quick practice for the selected question type", async () => {
    const user = userEvent.setup();
    const onStartQuickPractice = vi.fn();

    render(
      <HomePage
        onDifficultyChange={vi.fn()}
        onOpenWeakness={vi.fn()}
        onQuickPracticeTypeChange={vi.fn()}
        onSessionLengthChange={vi.fn()}
        onStartQuickPractice={onStartQuickPractice}
        onStartQuiz={vi.fn()}
        preferences={defaultPracticePreferences}
        quickPracticeType="fractions"
      />,
    );

    await user.click(screen.getByRole("button", { name: /開始 分數小數/ }));

    expect(onStartQuickPractice).toHaveBeenCalledTimes(1);
  });

  it("opens weakness analysis from the mode card", async () => {
    const user = userEvent.setup();
    const onOpenWeakness = vi.fn();

    render(
      <HomePage
        onDifficultyChange={vi.fn()}
        onOpenWeakness={onOpenWeakness}
        onQuickPracticeTypeChange={vi.fn()}
        onSessionLengthChange={vi.fn()}
        onStartQuickPractice={vi.fn()}
        onStartQuiz={vi.fn()}
        preferences={defaultPracticePreferences}
        quickPracticeType="arithmetic"
      />,
    );

    await user.click(screen.getByRole("button", { name: "查看弱項" }));

    expect(onOpenWeakness).toHaveBeenCalledTimes(1);
  });

  it("starts quiz mode from the featured card", async () => {
    const user = userEvent.setup();
    const onStartQuiz = vi.fn();

    render(
      <HomePage
        onDifficultyChange={vi.fn()}
        onOpenWeakness={vi.fn()}
        onQuickPracticeTypeChange={vi.fn()}
        onSessionLengthChange={vi.fn()}
        onStartQuickPractice={vi.fn()}
        onStartQuiz={onStartQuiz}
        preferences={defaultPracticePreferences}
        quickPracticeType="arithmetic"
      />,
    );

    await user.click(screen.getByRole("button", { name: "開始混合測驗" }));

    expect(onStartQuiz).toHaveBeenCalledTimes(1);
  });
});

describe("home page preference helpers", () => {
  it("builds quick practice preferences for a single type", () => {
    expect(getQuickPracticePreferences(defaultPracticePreferences, "powers")).toEqual({
      ...defaultPracticePreferences,
      mode: "powers",
      targetTags: undefined,
      targetTypes: undefined,
    });
  });

  it("builds quiz preferences with all question types selected", () => {
    expect(getQuizPreferences(defaultPracticePreferences)).toEqual({
      ...defaultPracticePreferences,
      mode: "mixed",
      targetTags: undefined,
      targetTypes: undefined,
      selectedQuestionTypes: ["arithmetic", "fractions", "powers"],
    });
  });
});
