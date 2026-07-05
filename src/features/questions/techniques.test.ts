import { describe, expect, it } from "vitest";
import {
  differenceOfSquaresTechnique,
  multiplicationTechnique,
  sumDiffProductTechnique,
} from "./techniques";

describe("techniques", () => {
  it("uses compensation for near-round multiplication", () => {
    const technique = multiplicationTechnique(49, 15);
    expect(technique.name).toBe("補償法");
    expect(technique.steps.at(-1)).toContain("735");
  });

  it("uses split multiplication for general cases", () => {
    const technique = multiplicationTechnique(23, 6);
    expect(technique.name).toBe("拆分乘法");
  });

  it("chooses direct squares for small difference of squares", () => {
    const technique = differenceOfSquaresTechnique(7, 3);
    expect(technique.name).toBe("先算兩個平方");
  });

  it("chooses formula for larger difference of squares", () => {
    const technique = differenceOfSquaresTechnique(13, 9);
    expect(technique.name).toBe("平方差公式");
  });

  it("supports sum-diff product technique", () => {
    const technique = sumDiffProductTechnique(7, 3);
    expect(technique.steps.at(-1)).toContain("40");
  });
});
