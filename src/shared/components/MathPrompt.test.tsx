import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MathPrompt } from "./MathPrompt";

describe("MathPrompt", () => {
  it("renders a latex-styled prompt with an accessible raw label", () => {
    const { container } = render(<MathPrompt text="5/6 + 1/3 = ?" />);

    expect(screen.getByLabelText("5/6 + 1/3 = ?")).toBeInTheDocument();
    expect(container.querySelector(".mfrac")).not.toBeNull();
  });
});
