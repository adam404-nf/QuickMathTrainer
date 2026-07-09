import { ZERO_STEP_ACCEPT_RATE } from "./selectionPolicy";
import { parseNumericAnswer } from "./utils";

export function isZeroStepResult(result: string): boolean {
  if (!result || result === "") return false;
  const n = parseNumericAnswer(result);
  return n !== undefined && Math.abs(n) < 1e-9;
}

export type ZeroStepDecision = "accept" | "reroll-numbers" | "reject-template";

export function decideZeroStep(params: {
  isZero: boolean;
  numberRerollCount: number;
  maxNumberRerolls: number;
  random?: () => number;
}): ZeroStepDecision {
  if (!params.isZero) {
    return "accept";
  }
  if (params.numberRerollCount < params.maxNumberRerolls) {
    return "reroll-numbers";
  }
  const roll = (params.random ?? Math.random)();
  return roll < ZERO_STEP_ACCEPT_RATE ? "accept" : "reject-template";
}
