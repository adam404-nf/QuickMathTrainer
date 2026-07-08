import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Question } from "../../questions/types";
import { CostInspector } from "./CostInspector";

const question: Question = {
  id: "test-question",
  kind: "fill-in",
  type: "arithmetic",
  prompt: "(7 + 5) × 6 = ?",
  answer: "72",
  difficulty: "medium",
  tags: ["addition", "multiplication"],
  mentalCost: 16,
  costTemplates: [
    { kind: "integer-add", a: 7, b: 5 },
    { kind: "integer-multiply", a: 12, b: 6 },
  ],
  technique: { name: "先算括號", steps: ["7 + 5 = 12", "12 × 6 = 72"] },
};

describe("CostInspector", () => {
  it("shows the cost value on the toggle button", () => {
    render(<CostInspector question={question} />);
    expect(screen.getByRole("button", { name: /Cost/ })).toBeInTheDocument();
  });

  it("reveals the difficulty range and calculation steps after clicking", async () => {
    const user = userEvent.setup();
    render(<CostInspector question={question} />);

    expect(screen.queryByText("計算過程")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Cost/ }));

    expect(screen.getByText("計算過程")).toBeInTheDocument();
    expect(screen.getByText("整數加法")).toBeInTheDocument();
    expect(screen.getByText("整數乘法")).toBeInTheDocument();
    expect(screen.getByText("難度標準範圍")).toBeInTheDocument();
    expect(screen.getByText("記憶成本")).toBeInTheDocument();
    expect(screen.getByText("+1.0")).toBeInTheDocument();
  });

  it("shows each numeric step with its actual expression and cost", async () => {
    const user = userEvent.setup();
    render(<CostInspector question={question} />);

    await user.click(screen.getByRole("button", { name: /Cost/ }));

    expect(screen.getByText("7 + 5 = 12")).toBeInTheDocument();
    expect(screen.getByText("12 × 6 = 72")).toBeInTheDocument();
    expect(screen.getAllByText(/cost:/).length).toBeGreaterThanOrEqual(2);
  });
});
