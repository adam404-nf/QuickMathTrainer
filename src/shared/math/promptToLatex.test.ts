import { describe, expect, it } from "vitest";
import { promptToLatex } from "./promptToLatex";

describe("promptToLatex", () => {
  it("keeps integer arithmetic readable in math mode", () => {
    expect(promptToLatex("((29 + 32 + 9) × 8 − 21) × 9 + 11 = ?")).toBe(
      "((29 + 32 + 9) \\times 8 - 21) \\times 9 + 11 = ?",
    );
  });

  it("renders slash fractions as stacked latex fractions", () => {
    expect(promptToLatex("5/6 + 1/3 = ?")).toBe("\\frac{5}{6} + \\frac{1}{3} = ?");
  });

  it("converts powers and roots", () => {
    expect(promptToLatex("7² − 5² = ?")).toBe("7^{2} - 5^{2} = ?");
    expect(promptToLatex("∛27 + 4 = ?")).toBe("\\sqrt[3]{27} + 4 = ?");
    expect(promptToLatex("⁴√81 + 3 = ?")).toBe("\\sqrt[4]{81} + 3 = ?");
    expect(promptToLatex("√144 = ?")).toBe("\\sqrt{144} = ?");
    expect(promptToLatex("√((78)²) = ?")).toBe("\\sqrt{(78)^{2}} = ?");
    expect(promptToLatex("√((-7)²) = ?")).toBe("\\sqrt{(-7)^{2}} = ?");
    expect(promptToLatex("√(A²) = ?")).toBe("\\sqrt{A^{2}} = ?");
  });

  it("wraps absolute values as left/right delimiters and wraps decimal hint text", () => {
    expect(promptToLatex("|−3| + 5 × 2 = ?")).toBe("\\left|-3\\right| + 5 \\times 2 = ?");
    expect(promptToLatex("|1/3 - 1/2| + 1/5 ÷ 3/8 = ? （分數）")).toBe(
      "\\left|\\frac{1}{3} - \\frac{1}{2}\\right| + \\frac{1}{5} \\div \\frac{3}{8} = ? \\text{（分數）}",
    );
    expect(promptToLatex("3/4 = ? (小數)")).toBe("\\frac{3}{4} = ? \\text{（小數）}");
  });
});
