import type { Difficulty, PracticeMode } from "./types";

export type TemplateCategory =
  | "integer"
  | "fraction"
  | "decimal"
  | "power"
  | "conversion"
  | "mixed-decimal-fraction";

export type OperationKind = string;

export const HARD_TEMPLATE_CATEGORIES = [
  "fraction",
  "power",
  "conversion",
  "mixed-decimal-fraction",
] as const satisfies readonly TemplateCategory[];

export const MAX_SAME_KIND_EXTRA = 2;
export const NON_ZERO_STEP_TARGET = 0.98;
export const ZERO_STEP_ACCEPT_RATE = 0.02;
export const THEME_STEP_TARGET = 0.7;

const MIXED_HARD_TARGETS: Record<Difficulty, number> = {
  easy: 0.65,
  medium: 0.7,
  hard: 0.75,
  extreme: 0.8,
};

export function isHardTemplateCategory(category: TemplateCategory): boolean {
  return (HARD_TEMPLATE_CATEGORIES as readonly TemplateCategory[]).includes(category);
}

export function isDecimalTemplateCategory(category: TemplateCategory): boolean {
  return category === "decimal";
}

export function hardExcludedCategories(mode: PracticeMode): readonly TemplateCategory[] {
  if (mode === "arithmetic") {
    return ["fraction", "decimal", "power", "conversion", "mixed-decimal-fraction"];
  }
  if (mode === "fractions") {
    return ["power"];
  }
  return [];
}

export function isCategoryAllowed(mode: PracticeMode, category: TemplateCategory): boolean {
  return !hardExcludedCategories(mode).includes(category);
}

export function decimalCapForContext(input: {
  mode: PracticeMode;
  targetTags?: readonly string[];
}): number | null {
  if (input.mode === "arithmetic") {
    return 0;
  }
  if (input.mode === "weakness-focused" && input.targetTags?.includes("decimals")) {
    return null;
  }
  if (input.mode === "fractions") {
    return 0.2;
  }
  if (input.mode === "mixed" || input.mode === "powers") {
    return 0.1;
  }
  // weakness-focused 非 decimals、其他模式：預設路徑由後續任務補齊
  if (input.mode === "weakness-focused") {
    return 0.1;
  }
  return 0.1;
}

export function mixedHardTemplateTarget(difficulty: Difficulty): number {
  return MIXED_HARD_TARGETS[difficulty];
}

export function themeStepTarget(input: {
  mode: PracticeMode;
  targetTags?: readonly string[];
}): number {
  if (input.mode === "mixed") {
    return 0;
  }
  return THEME_STEP_TARGET;
}

export function isThemeCategory(
  input: { mode: PracticeMode; targetTags?: readonly string[] },
  category: TemplateCategory,
): boolean {
  if (input.mode === "arithmetic") return category === "integer";
  if (input.mode === "fractions") {
    return (
      category === "fraction" ||
      category === "decimal" ||
      category === "conversion" ||
      category === "mixed-decimal-fraction"
    );
  }
  if (input.mode === "powers") return category === "power";
  if (input.mode === "weakness-focused") {
    const tags = input.targetTags ?? [];
    if (tags.includes("decimals")) return category === "decimal";
    if (tags.includes("fractions")) {
      return category === "fraction" || category === "conversion" || category === "mixed-decimal-fraction";
    }
    // 其他 tag：以 specialty 過濾為主；分類層給寬鬆 true 讓 operation/tag 決定
    return true;
  }
  return false;
}

export function isThemeOperationKind(
  input: { mode: PracticeMode; targetTags?: readonly string[] },
  _operationKind: OperationKind,
  category: TemplateCategory,
): boolean {
  return isThemeCategory(input, category);
}

export type RelaxableConstraint = "decimal-cap" | "theme-ratio" | "hard-template-ratio";

export function relaxationOrder(): readonly RelaxableConstraint[] {
  return ["decimal-cap", "theme-ratio", "hard-template-ratio"];
}

export function neverRelaxCostRange(): true {
  return true;
}

/**
 * Mixed 模式專用類別權重；難模板比例對齊 mixedHardTemplateTarget。
 * 軟類別僅 integer + decimal；decimal 仍受 decimalCap 等約束限制。
 */
export function categoryWeightForMixed(difficulty: Difficulty, category: TemplateCategory): number {
  const hardShare = mixedHardTemplateTarget(difficulty);
  const softShare = 1 - hardShare;
  if (isHardTemplateCategory(category)) {
    // 均分於四類 hardShare（實際可調，但比例維持目標）
    return hardShare / HARD_TEMPLATE_CATEGORIES.length;
  }
  if (category === "integer") {
    return softShare * 0.85;
  }
  if (category === "decimal") {
    return softShare * 0.15;
  }
  return 0;
}

export function categoryWeightForMode(
  input: { mode: PracticeMode; difficulty: Difficulty; targetTags?: readonly string[] },
  category: TemplateCategory,
): number {
  if (!isCategoryAllowed(input.mode, category)) {
    return 0;
  }

  if (input.mode === "mixed") {
    return categoryWeightForMixed(input.difficulty, category);
  }

  if (input.mode === "arithmetic") {
    return category === "integer" ? 1 : 0;
  }

  if (input.mode === "powers") {
    if (category === "power") return 0.9;
    if (category === "integer") return 0.05;
    if (category === "decimal") return 0.05; // 受 10% cap 約束
    return 0;
  }

  if (input.mode === "fractions") {
    const weights: Record<TemplateCategory, number> = {
      integer: 0.1,
      fraction: 0.45,
      decimal: 0.2,
      power: 0,
      conversion: 0.1,
      "mixed-decimal-fraction": 0.15,
    };
    return weights[category];
  }

  // weakness-focused：依弱點標籤分配
  const tags = input.targetTags ?? [];
  if (tags.includes("decimals") && category === "decimal") return 0.7;
  if (tags.includes("fractions") && (category === "fraction" || category === "conversion" || category === "mixed-decimal-fraction")) {
    return category === "fraction" ? 0.5 : 0.1;
  }
  if ((tags.includes("square") || tags.includes("cube") || tags.includes("square-root")) && category === "power") {
    return 0.7;
  }
  if (tags.includes("absolute-value")) {
    // 絕對值專題：不受 specialty tag 分流影響，此處為預設
    return 0.25;
  }
  return isHardTemplateCategory(category) ? 0.2 : category === "integer" ? 0.3 : 0.1;
}
