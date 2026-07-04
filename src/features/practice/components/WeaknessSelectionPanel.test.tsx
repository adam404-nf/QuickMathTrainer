import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SkillMetric } from "../../results/weakness";
import { WeaknessSelectionPanel } from "./WeaknessSelectionPanel";

const weakTags: SkillMetric[] = [
  {
    key: "addition",
    label: "加法",
    scope: "tag",
    questionCount: 4,
    correctCount: 2,
    accuracy: 0.5,
    averageTimeMs: 6000,
    mistakeCount: 2,
    status: "weak",
    diagnosis: "加法正確率偏低，建議先求穩再求快。",
  },
  {
    key: "multiplication",
    label: "乘法",
    scope: "tag",
    questionCount: 3,
    correctCount: 1,
    accuracy: 0.33,
    averageTimeMs: 7000,
    mistakeCount: 2,
    status: "weak",
    diagnosis: "乘法正確率偏低，建議先求穩再求快。",
  },
  {
    key: "decimals",
    label: "小數",
    scope: "tag",
    questionCount: 2,
    correctCount: 1,
    accuracy: 0.5,
    averageTimeMs: 8000,
    mistakeCount: 1,
    status: "weak",
  },
];

describe("WeaknessSelectionPanel", () => {
  it("supports multi-select and starts practice with selected tags", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();

    render(
      <WeaknessSelectionPanel
        isReady
        onBack={vi.fn()}
        onStart={onStart}
        weakTags={weakTags}
        weakTypes={[]}
      />,
    );

    const startButton = screen.getByRole("button", { name: /開始專攻/ });
    expect(startButton).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: /加法/ }));
    await user.click(screen.getByRole("checkbox", { name: /乘法/ }));

    expect(startButton).toBeEnabled();
    expect(startButton).toHaveTextContent("已選 2 項");

    await user.click(startButton);

    expect(onStart).toHaveBeenCalledWith(["addition", "multiplication"]);
  });

  it("selects all weak tags with the select-all control", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();

    render(
      <WeaknessSelectionPanel
        isReady
        onBack={vi.fn()}
        onStart={onStart}
        weakTags={weakTags}
        weakTypes={[]}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: /全部弱項/ }));

    const startButton = screen.getByRole("button", { name: /開始專攻/ });
    expect(startButton).toHaveTextContent("已選 3 項");

    await user.click(startButton);

    expect(onStart).toHaveBeenCalledWith(["addition", "multiplication", "decimals"]);
  });

  it("prefills selected tags when provided", () => {
    render(
      <WeaknessSelectionPanel
        isReady
        onBack={vi.fn()}
        onStart={vi.fn()}
        preselectedTags={["decimals"]}
        weakTags={weakTags}
        weakTypes={[]}
      />,
    );

    expect(screen.getByRole("checkbox", { name: /小數/ })).toBeChecked();
    expect(screen.getByRole("button", { name: /開始專攻/ })).toHaveTextContent("已選 1 項");
  });
});
