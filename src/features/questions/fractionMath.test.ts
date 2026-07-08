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

  it("maps high LCM to unlike-denom cost tiers", () => {
    const small = unlikeDenomBaseCost({ num: 1, den: 2 }, { num: 1, den: 3 });
    const medium = unlikeDenomBaseCost({ num: 1, den: 7 }, { num: 1, den: 12 });
    const rejected = unlikeDenomBaseCost({ num: 1, den: 7 }, { num: 1, den: 17 });

    expect(small).toBeCloseTo(5.4);
    expect(small).toBeLessThan(8);
    expect(medium).toBeGreaterThanOrEqual(small);
    expect(rejected).toBe(0);
  });

  it("charges denominator expansion for unlike denominators", () => {
    const cost = unlikeDenomBaseCost({ num: 3, den: 4 }, { num: 1, den: 6 });
    expect(cost).toBeCloseTo(6.2);
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
