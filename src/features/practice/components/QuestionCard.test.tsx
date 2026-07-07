import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Question } from "../../questions/types";
import { QuestionCard } from "./QuestionCard";

const question: Question = {
  id: "fraction-question",
  kind: "fill-in",
  type: "fractions",
  prompt: "5/6 + 1/3 = ?",
  answer: "7/6",
  difficulty: "medium",
  tags: ["fractions"],
  mentalCost: 14,
  technique: { name: "通分", steps: ["5/6 + 1/3 = 7/6"] },
};

describe("QuestionCard", () => {
  it("renders the prompt through the math display component", () => {
    const { container } = render(
      <QuestionCard currentIndex={0} question={question} totalQuestions={10} />,
    );

    expect(screen.getByLabelText("5/6 + 1/3 = ?")).toBeInTheDocument();
    expect(container.querySelector(".mfrac")).not.toBeNull();
  });
});
