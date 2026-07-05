import { describe, expect, it } from "vitest";
import { unlikeDenomBaseCost } from "./calculationTemplates";
import {
  buildFractionAbsComposite,
  buildFractionComposite,
  formatFraction,
  lcm,
  simplifyFraction,
  unlikeDenominatorTechnique,
} from "./fractionMath";

describe("fractionMath", () => {
  it("adds unlike denominators", () => {
    const left = { num: 1, den: 2 };
    const right = { num: 1, den: 3 };
    const technique = unlikeDenominatorTechnique(left, right, "+");
    expect(technique.name).toBe("通分");
    expect(formatFraction(simplifyFraction({ num: 5, den: 6 }))).toBe("5/6");
  });

  it("maps high LCM to unlike-denom baseCost tiers", () => {
    expect(unlikeDenomBaseCost({ num: 1, den: 2 }, { num: 1, den: 3 })).toBe(3);
    expect(unlikeDenomBaseCost({ num: 1, den: 7 }, { num: 1, den: 12 })).toBe(5);
    expect(unlikeDenomBaseCost({ num: 1, den: 7 }, { num: 1, den: 17 })).toBe(0);
  });

  it("builds a fraction composite with valid answer", () => {
    const built = buildFractionComposite("medium", 2);
    expect(built).not.toBeNull();
    expect(built?.prompt).toContain("= ?");
    expect(built?.answer.length).toBeGreaterThan(0);
    expect(built?.calculationTemplates.length).toBeGreaterThan(0);
  });

  it("builds abs fraction composite", () => {
    const built = buildFractionAbsComposite("medium", false);
    expect(built).not.toBeNull();
    expect(built?.tags).toContain("absolute-value");
  });

  it("rejects denominator pairs above LCM cap", () => {
    expect(lcm(7, 17)).toBeGreaterThan(100);
    expect(unlikeDenomBaseCost({ num: 1, den: 7 }, { num: 1, den: 17 })).toBe(0);
  });
});
