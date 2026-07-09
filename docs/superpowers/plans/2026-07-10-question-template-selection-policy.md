# Question Template Selection Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立集中式 `selectionPolicy` 作為出題權重唯一來源，並接入 registry／generators／appendStep，使一般／mixed、專項、弱項在小數上限、難模板比例、主題步驟聚焦、非零步驟與模式硬排除上行為一致且可測。

**Architecture:** 新增 `selectionPolicy.ts` 定義分類、權重、硬排除、非零接受率與衝突放寬順序；將 `QuestionTemplate` 升級為帶 `category`／`operationKind` 的 descriptor；`pickWeighted` 供 registry 與 `generateFromTemplates` 加權抽樣；`appendStep` 依 policy 優先同主題並套用 `MAX_SAME_KIND_EXTRA`；數字生成路徑套用非零 reroll 與絕對值難度範圍。不改 `mentalCost` 公式與 cost range。

**Tech Stack:** TypeScript、Vitest（`npm run test:run`）、既有 `src/features/questions/` 模組（`registry.ts`、`generators/utils.ts`、`generators/appendStep.ts`、`templates.ts`、`calculationTemplates.ts`、`utils.ts`）。

## Global Constraints

- 出題權重**唯一來源**為 `selectionPolicy`；registry／generators／append 不得另寫衝突硬編碼比例。
- 「小數模板」＝僅 `decimal`；`conversion` 與 `mixed-decimal-fraction` **不**受小數上限約束，但計入難模板。
- 「難模板」＝`fraction` ∪ `power` ∪ `conversion` ∪ `mixed-decimal-fraction`。
- Mixed 難模板合計：`easy` 65%、`medium` 70%、`hard` 75%、`extreme` 80%。
- 小數上限：一般／mixed／`powers` ~10%；`fractions` ~20%；`arithmetic` 硬排除 0%；弱項 `decimals` 不受 10% 壓制，改走主題 ~70%。
- 專項／弱項整題 `costTemplates` 主題步驟占比 ~70%；`MAX_SAME_KIND_EXTRA = 2`。
- 模式硬排除永不放寬：`arithmetic` 僅 `integer`；`fractions` 禁止 `power`。
- 步驟中間結果非零 ~98%；零結果順序：同模板 reroll 數字 → 約 2% 接受 → 換模板。
- 衝突優先序：硬排除 → 合法題 + cost in-range → 主題／難模板比例 → 小數上限；耗盡只放寬比例，**不放寬** cost range。
- **不改** `mentalCost` 公式、chunk 常數、`DIFFICULTY_COST_RANGES`。
- 不新增獨立 decimals generator；不夾帶無關 WIP。
- 測試指令：`npm run test:run -- <path>`（Vitest）。

I'm using the writing-plans skill to create the implementation plan.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/features/questions/selectionPolicy.ts` | 權重／分類／硬排除／非零／衝突優先序唯一來源 |
| `src/features/questions/selectionPolicy.test.ts` | Policy 單元測試 |
| `src/features/questions/utils.ts` | 新增 `pickWeighted` |
| `src/features/questions/utils.test.ts` | `pickWeighted` 測試 |
| `src/features/questions/templates.ts` | Template descriptor + category／operationKind metadata |
| `src/features/questions/templates.test.ts` | 分類邊界與 descriptor 回歸 |
| `src/features/questions/calculationTemplates.ts` | 匯出 `resultForTemplate`／`isZeroStepResult` |
| `src/features/questions/registry.ts` | 題型加權抽樣；soft quota 讓位；放寬比例 |
| `src/features/questions/generators/utils.ts` | 模板加權抽樣；非零策略；小數／主題約束 |
| `src/features/questions/generators/appendStep.ts` | 主題優先 append + 同類重複上限 |
| `src/features/questions/generators/appendStep.test.ts` | append 主題／重複測試 |
| `src/features/questions/registry.test.ts` | Monte Carlo 分布 + 回歸 |
| `src/features/questions/nonZeroStep.ts` | 非零步驟決策純函式（可測） |
| `src/features/questions/nonZeroStep.test.ts` | 非零策略測試 |
| `docs/superpowers/specs/2026-07-10-question-template-selection-policy-design.md` | 實作完成後加「實作計畫」交叉引用（Task 9） |

---

### Task 1: selectionPolicy 純函式與權重表

**Files:**
- Create: `src/features/questions/selectionPolicy.ts`
- Create: `src/features/questions/selectionPolicy.test.ts`
- Modify: `src/features/questions/utils.ts`（新增 `pickWeighted`）
- Modify: `src/features/questions/utils.test.ts`

**Interfaces:**
- Consumes: `Difficulty`、`PracticeMode` from `./types`
- Produces:
  - `export type TemplateCategory = "integer" | "fraction" | "decimal" | "power" | "conversion" | "mixed-decimal-fraction"`
  - `export type OperationKind = string`
  - `export const HARD_TEMPLATE_CATEGORIES: readonly TemplateCategory[]`
  - `export const MAX_SAME_KIND_EXTRA = 2`
  - `export const NON_ZERO_STEP_TARGET = 0.98`
  - `export const ZERO_STEP_ACCEPT_RATE = 0.02`
  - `export const THEME_STEP_TARGET = 0.7`
  - `export function isHardTemplateCategory(category: TemplateCategory): boolean`
  - `export function isDecimalTemplateCategory(category: TemplateCategory): boolean`
  - `export function hardExcludedCategories(mode: PracticeMode): readonly TemplateCategory[]`
  - `export function isCategoryAllowed(mode: PracticeMode, category: TemplateCategory): boolean`
  - `export function decimalCapForContext(input: { mode: PracticeMode; targetTags?: readonly string[] }): number | null` — `null` = 不套用上限；`0` = 硬排除；`0.1`／`0.2` = soft cap
  - `export function mixedHardTemplateTarget(difficulty: Difficulty): number` — 0.65／0.70／0.75／0.80
  - `export function themeStepTarget(_input: { mode: PracticeMode; targetTags?: readonly string[] }): number` — 專項／弱項回傳 `0.7`，否則 `0`
  - `export type RelaxableConstraint = "decimal-cap" | "theme-ratio" | "hard-template-ratio"`
  - `export function relaxationOrder(): readonly RelaxableConstraint[]` — `["decimal-cap", "theme-ratio", "hard-template-ratio"]`
  - `export function neverRelaxCostRange(): true` — 恆為 `true`（文件化＋測試錨點）
  - `export function categoryWeightForMixed(difficulty: Difficulty, category: TemplateCategory): number`
  - `export function categoryWeightForMode(input: { mode: PracticeMode; difficulty: Difficulty; targetTags?: readonly string[] }, category: TemplateCategory): number`
  - `export function pickWeighted<T>(items: readonly T[], weightOf: (item: T) => number): T` in `./utils`

- [ ] **Step 1: Write the failing tests**

在 `src/features/questions/selectionPolicy.test.ts`：

```typescript
import { describe, expect, it } from "vitest";
import {
  HARD_TEMPLATE_CATEGORIES,
  MAX_SAME_KIND_EXTRA,
  NON_ZERO_STEP_TARGET,
  ZERO_STEP_ACCEPT_RATE,
  THEME_STEP_TARGET,
  categoryWeightForMode,
  decimalCapForContext,
  hardExcludedCategories,
  isCategoryAllowed,
  isDecimalTemplateCategory,
  isHardTemplateCategory,
  mixedHardTemplateTarget,
  neverRelaxCostRange,
  relaxationOrder,
  themeStepTarget,
  type TemplateCategory,
} from "./selectionPolicy";

describe("selectionPolicy constants", () => {
  it("defines hard-template categories and decimal-only decimal definition", () => {
    expect(HARD_TEMPLATE_CATEGORIES).toEqual([
      "fraction",
      "power",
      "conversion",
      "mixed-decimal-fraction",
    ]);
    expect(isDecimalTemplateCategory("decimal")).toBe(true);
    expect(isDecimalTemplateCategory("conversion")).toBe(false);
    expect(isDecimalTemplateCategory("mixed-decimal-fraction")).toBe(false);
    for (const c of HARD_TEMPLATE_CATEGORIES) {
      expect(isHardTemplateCategory(c)).toBe(true);
    }
    expect(isHardTemplateCategory("integer")).toBe(false);
    expect(isHardTemplateCategory("decimal")).toBe(false);
  });

  it("exposes non-zero and theme targets", () => {
    expect(NON_ZERO_STEP_TARGET).toBe(0.98);
    expect(ZERO_STEP_ACCEPT_RATE).toBe(0.02);
    expect(THEME_STEP_TARGET).toBe(0.7);
    expect(MAX_SAME_KIND_EXTRA).toBe(2);
  });
});

describe("decimalCapForContext", () => {
  it("returns 0.1 for mixed and powers", () => {
    expect(decimalCapForContext({ mode: "mixed" })).toBe(0.1);
    expect(decimalCapForContext({ mode: "powers" })).toBe(0.1);
  });

  it("returns 0.2 for fractions specialty", () => {
    expect(decimalCapForContext({ mode: "fractions" })).toBe(0.2);
  });

  it("returns 0 for arithmetic hard exclusion", () => {
    expect(decimalCapForContext({ mode: "arithmetic" })).toBe(0);
  });

  it("disables decimal cap for weakness-focused decimals", () => {
    expect(
      decimalCapForContext({ mode: "weakness-focused", targetTags: ["decimals"] }),
    ).toBeNull();
  });
});

describe("mixedHardTemplateTarget", () => {
  it("matches difficulty table", () => {
    expect(mixedHardTemplateTarget("easy")).toBe(0.65);
    expect(mixedHardTemplateTarget("medium")).toBe(0.7);
    expect(mixedHardTemplateTarget("hard")).toBe(0.75);
    expect(mixedHardTemplateTarget("extreme")).toBe(0.8);
  });
});

describe("mode hard exclusions", () => {
  const all: TemplateCategory[] = [
    "integer",
    "fraction",
    "decimal",
    "power",
    "conversion",
    "mixed-decimal-fraction",
  ];

  it("arithmetic allows only integer", () => {
    expect(hardExcludedCategories("arithmetic")).toEqual([
      "fraction",
      "decimal",
      "power",
      "conversion",
      "mixed-decimal-fraction",
    ]);
    for (const c of all) {
      expect(isCategoryAllowed("arithmetic", c)).toBe(c === "integer");
    }
  });

  it("fractions forbids power only", () => {
    expect(hardExcludedCategories("fractions")).toEqual(["power"]);
    for (const c of all) {
      expect(isCategoryAllowed("fractions", c)).toBe(c !== "power");
    }
  });

  it("mixed and weakness-focused do not use arithmetic/fractions hard table", () => {
    expect(hardExcludedCategories("mixed")).toEqual([]);
    expect(hardExcludedCategories("weakness-focused")).toEqual([]);
    expect(hardExcludedCategories("powers")).toEqual([]);
  });
});

describe("theme and relaxation", () => {
  it("theme target is 0.7 for specialty and weakness", () => {
    expect(themeStepTarget({ mode: "fractions" })).toBe(0.7);
    expect(themeStepTarget({ mode: "arithmetic" })).toBe(0.7);
    expect(themeStepTarget({ mode: "powers" })).toBe(0.7);
    expect(themeStepTarget({ mode: "weakness-focused", targetTags: ["decimals"] })).toBe(0.7);
    expect(themeStepTarget({ mode: "mixed" })).toBe(0);
  });

  it("relaxes decimal-cap before theme/hard ratios and never cost range", () => {
    expect(relaxationOrder()).toEqual([
      "decimal-cap",
      "theme-ratio",
      "hard-template-ratio",
    ]);
    expect(neverRelaxCostRange()).toBe(true);
  });
});

describe("categoryWeightForMode", () => {
  it("gives arithmetic zero weight to non-integer", () => {
    expect(categoryWeightForMode({ mode: "arithmetic", difficulty: "medium" }, "integer")).toBeGreaterThan(0);
    expect(categoryWeightForMode({ mode: "arithmetic", difficulty: "medium" }, "decimal")).toBe(0);
    expect(categoryWeightForMode({ mode: "arithmetic", difficulty: "medium" }, "fraction")).toBe(0);
  });

  it("gives fractions zero weight to power", () => {
    expect(categoryWeightForMode({ mode: "fractions", difficulty: "medium" }, "power")).toBe(0);
    expect(categoryWeightForMode({ mode: "fractions", difficulty: "medium" }, "fraction")).toBeGreaterThan(0);
  });

  it("boosts hard categories in mixed extreme vs easy", () => {
    const hardExtreme = categoryWeightForMode({ mode: "mixed", difficulty: "extreme" }, "fraction");
    const hardEasy = categoryWeightForMode({ mode: "mixed", difficulty: "easy" }, "fraction");
    const intExtreme = categoryWeightForMode({ mode: "mixed", difficulty: "extreme" }, "integer");
    const intEasy = categoryWeightForMode({ mode: "mixed", difficulty: "easy" }, "integer");
    expect(hardExtreme / (hardExtreme + intExtreme)).toBeGreaterThan(hardEasy / (hardEasy + intEasy));
  });
});
```

在 `src/features/questions/utils.test.ts` 追加：

```typescript
import { pickWeighted } from "./utils";

describe("pickWeighted", () => {
  it("never picks zero-weight items", () => {
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 50; i += 1) {
      const picked = pickWeighted(["a", "b"] as const, (x) => (x === "a" ? 0 : 1));
      counts[picked] += 1;
    }
    expect(counts.a).toBe(0);
    expect(counts.b).toBe(50);
  });

  it("throws on empty or all-zero weights", () => {
    expect(() => pickWeighted([], () => 1)).toThrow();
    expect(() => pickWeighted(["a"], () => 0)).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/features/questions/selectionPolicy.test.ts src/features/questions/utils.test.ts`

Expected: FAIL — `Cannot find module './selectionPolicy'` 或 `pickWeighted is not a function`

- [ ] **Step 3: Write minimal implementation**

在 `src/features/questions/utils.ts` 新增：

```typescript
export function pickWeighted<T>(items: readonly T[], weightOf: (item: T) => number): T {
  if (items.length === 0) {
    throw new Error("Cannot pick from an empty array.");
  }
  const weights = items.map((item) => Math.max(0, weightOf(item)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) {
    throw new Error("Cannot pick from all-zero weights.");
  }
  let target = Math.random() * total;
  for (let i = 0; i < items.length; i += 1) {
    target -= weights[i];
    if (target <= 0) {
      return items[i];
    }
  }
  return items[items.length - 1];
}
```

建立 `src/features/questions/selectionPolicy.ts`：

```typescript
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
  // weakness-focused 非 decimals、或其他：非主題路徑仍可受一般上限；主路徑由主題比例主導
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

export type RelaxableConstraint = "decimal-cap" | "theme-ratio" | "hard-template-ratio";

export function relaxationOrder(): readonly RelaxableConstraint[] {
  return ["decimal-cap", "theme-ratio", "hard-template-ratio"];
}

export function neverRelaxCostRange(): true {
  return true;
}

/**
 * Mixed 模式下各分類相對權重：難模板合計對齊 mixedHardTemplateTarget，
 * 其餘分給 integer + decimal（decimal 再由 decimalCap 在抽樣層壓制）。
 */
export function categoryWeightForMixed(difficulty: Difficulty, category: TemplateCategory): number {
  const hardShare = mixedHardTemplateTarget(difficulty);
  const softShare = 1 - hardShare;
  if (isHardTemplateCategory(category)) {
    // 四類難模板均分 hardShare（實作可微調，但合計應對齊目標）
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
    if (category === "decimal") return 0.05; // 再由 10% cap 壓制
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

  // weakness-focused：主題分類高權重
  const tags = input.targetTags ?? [];
  if (tags.includes("decimals") && category === "decimal") return 0.7;
  if (tags.includes("fractions") && (category === "fraction" || category === "conversion" || category === "mixed-decimal-fraction")) {
    return category === "fraction" ? 0.5 : 0.1;
  }
  if ((tags.includes("square") || tags.includes("cube") || tags.includes("square-root")) && category === "power") {
    return 0.7;
  }
  if (tags.includes("absolute-value")) {
    // 絕對值跨分類；權重由 specialty tag 過濾主導，此處給非零基線
    return 0.25;
  }
  return isHardTemplateCategory(category) ? 0.2 : category === "integer" ? 0.3 : 0.1;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/features/questions/selectionPolicy.test.ts src/features/questions/utils.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/questions/selectionPolicy.ts src/features/questions/selectionPolicy.test.ts src/features/questions/utils.ts src/features/questions/utils.test.ts
git commit -m "$(cat <<'EOF'
feat(questions): add selectionPolicy weights and pickWeighted

Centralize template-category weights, hard exclusions, decimal caps, and
relaxation order as the single source for question selection.
EOF
)"
```

---

### Task 2: 模板 category／operationKind metadata

**Files:**
- Modify: `src/features/questions/templates.ts`
- Modify: `src/features/questions/templates.test.ts`
- Modify: `src/features/questions/generators/arithmetic.ts`
- Modify: `src/features/questions/generators/fractions.ts`
- Modify: `src/features/questions/generators/powers.ts`
- Modify: `src/features/questions/selectionPolicy.ts`（新增主題判定 helpers，若尚未在 Task 1 完整）

**Interfaces:**
- Consumes: `TemplateCategory`、`OperationKind` from `./selectionPolicy`
- Produces:
  - `export type QuestionTemplateFn = (input: QuestionTemplateInput) => Question`
  - `export interface QuestionTemplateDescriptor { id: string; category: TemplateCategory; operationKind: OperationKind; generate: QuestionTemplateFn }`
  - `export type QuestionTemplate = QuestionTemplateDescriptor`（破壞性升級：陣列元素改為 descriptor）
  - 既有 `arithmeticTemplates`／`fractionTemplates`／`powersTemplates`／`allTemplates` 改為 `readonly QuestionTemplateDescriptor[]`
  - `filterTemplates`／`templateMatchesTags`／`getQuestionTypesForTags` 改吃 descriptor（用 `template.generate(...)` 取樣）
  - `export function getTemplateCategory(template: QuestionTemplateDescriptor): TemplateCategory`
  - 在 `selectionPolicy.ts` 新增：
    - `export function isThemeCategory(input: { mode: PracticeMode; targetTags?: readonly string[] }, category: TemplateCategory): boolean`
    - `export function isThemeOperationKind(input: { mode: PracticeMode; targetTags?: readonly string[] }, operationKind: OperationKind, category: TemplateCategory): boolean`

- [ ] **Step 1: Write the failing tests**

在 `src/features/questions/templates.test.ts` 追加（若檔案無 describe 則新建對應區塊）：

```typescript
import { describe, expect, it } from "vitest";
import {
  allTemplates,
  arithmeticTemplates,
  fractionTemplates,
  powersTemplates,
} from "./templates";
import {
  isDecimalTemplateCategory,
  isHardTemplateCategory,
  type TemplateCategory,
} from "./selectionPolicy";

function categoriesOf(templates: readonly { category: TemplateCategory }[]): TemplateCategory[] {
  return templates.map((t) => t.category);
}

describe("template category metadata", () => {
  it("assigns exactly one category to every template", () => {
    for (const template of allTemplates) {
      expect(template.id).toBeTruthy();
      expect(template.category).toBeTruthy();
      expect(template.operationKind).toBeTruthy();
      expect(typeof template.generate).toBe("function");
    }
  });

  it("marks pure decimal templates as decimal only", () => {
    const decimalIds = fractionTemplates
      .filter((t) => t.category === "decimal")
      .map((t) => t.id);
    expect(decimalIds.length).toBeGreaterThan(0);
    // conversion / mixed 不得標成 decimal
    for (const t of fractionTemplates) {
      if (t.id.includes("conversion") || t.id.includes("mixed-decimal-fraction")) {
        expect(t.category).not.toBe("decimal");
      }
    }
  });

  it("treats conversion and mixed-decimal-fraction as hard but not decimal", () => {
    const conversion = fractionTemplates.find((t) => t.category === "conversion");
    const mixed = fractionTemplates.find((t) => t.category === "mixed-decimal-fraction");
    expect(conversion).toBeDefined();
    expect(mixed).toBeDefined();
    expect(isHardTemplateCategory(conversion!.category)).toBe(true);
    expect(isHardTemplateCategory(mixed!.category)).toBe(true);
    expect(isDecimalTemplateCategory(conversion!.category)).toBe(false);
    expect(isDecimalTemplateCategory(mixed!.category)).toBe(false);
  });

  it("keeps arithmetic specialty templates as integer (no power/fraction/decimal)", () => {
    for (const c of categoriesOf(arithmeticTemplates)) {
      expect(c).toBe("integer");
    }
  });

  it("keeps powers templates as power", () => {
    for (const c of categoriesOf(powersTemplates)) {
      expect(c).toBe("power");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/features/questions/templates.test.ts`

Expected: FAIL — templates 仍是函式、無 `.category`

- [ ] **Step 3: Write minimal implementation**

在 `templates.ts` 將型別改為：

```typescript
import type { OperationKind, TemplateCategory } from "./selectionPolicy";

export type QuestionTemplateFn = (input: QuestionTemplateInput) => Question;

export interface QuestionTemplateDescriptor {
  id: string;
  category: TemplateCategory;
  /** 同題同類可控重複用的運算族鍵（細於六大分類） */
  operationKind: OperationKind;
  generate: QuestionTemplateFn;
}

export type QuestionTemplate = QuestionTemplateDescriptor;

function describeTemplate(
  id: string,
  category: TemplateCategory,
  operationKind: OperationKind,
  generate: QuestionTemplateFn,
): QuestionTemplateDescriptor {
  return {
    id,
    category,
    operationKind,
    generate: (input) => {
      const question = generate(input);
      return { ...question, templateId: id, templateCategory: category };
    },
  };
}
```

在 `types.ts` 的 `Question` 同步新增：

```typescript
templateId?: string;
/** 主模板分類；由 QuestionTemplateDescriptor.generate 寫入，供 policy／Monte Carlo 使用 */
templateCategory?: "integer" | "fraction" | "decimal" | "power" | "conversion" | "mixed-decimal-fraction";
```

將每個陣列元素包成 `describeTemplate(...)`。分類對照（必須完整標註，不可猜 tag）：

| 區域 | category | 範例 operationKind |
|------|----------|-------------------|
| `arithmeticTemplates` 全部 | `integer` | `integer-multiply`、`integer-add`、`integer-divide`、`integer-parentheses-multiply`、`integer-multiply-then-add`、`difference-of-squares`、`sum-diff-product`、`integer-abs-composite`、`double-abs`、`integer-subtract`、`integer-subtract-chain` |
| `powersTemplates`／composite | `power` | `square`、`square-root`、`cube`、`fourth-power`、`cube-root`、`fourth-root`、`sqrt-abs`、`symbolic-abs`、`abs-square`、以及各 composite id |
| `fractionTemplates` 同分母／異分母／乘除／composite／abs | `fraction` | `fraction-same-denom-add`、`fraction-unlike-add`、`fraction-unlike-sub`、`fraction-multiply`、`fraction-divide`、`fraction-composite-2`、`fraction-composite-3`、`fraction-abs`、`fraction-abs-nested` |
| 分數→小數轉換題 | `conversion` | `fraction-to-decimal` |
| 純小數加減乘／小數平方／`decimalCompositeTemplate` | `decimal` | `decimal-add`、`decimal-multiply`、`decimal-subtract`、`decimal-square`、`decimal-composite` |
| 分數小數混合運算題 | `mixed-decimal-fraction` | `decimal-fraction-mixed` |

更新 `templateMatchesTags`／`filterTemplates`／`getQuestionTypesForTags`：

```typescript
const sample = template.generate({ difficulty: "medium", kind: "fill-in" });
```

更新 generators：

```typescript
// arithmetic.ts / fractions.ts / powers.ts
return generateFromTemplates(arithmeticTemplates /* etc */, input);
```

（`generateFromTemplates` 在 Task 4 改吃 descriptor；本 task 先讓型別編譯：若 Task 4 尚未做，可暫時在 `generators/utils.ts` 把參數改為 `readonly QuestionTemplateDescriptor[]` 並用 `pickOne(pool).generate(...)`——若會破壞編譯，將 `generateFromTemplates` 的最小相容改動併入本 task Step 3。）

`generators/utils.ts` 最小相容（本 task 必須編譯通過）：

```typescript
const template = pickOne(pool);
let question = template.generate({
  difficulty: input.difficulty,
  kind: chooseQuestionKind(),
});
```

在 `selectionPolicy.ts` 新增主題判定：

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/features/questions/templates.test.ts src/features/questions/selectionPolicy.test.ts src/features/questions/generators/appendStep.test.ts`

Expected: PASS（既有 generator 路徑仍可出題）

- [ ] **Step 5: Commit**

```bash
git add src/features/questions/templates.ts src/features/questions/templates.test.ts src/features/questions/generators/utils.ts src/features/questions/generators/arithmetic.ts src/features/questions/generators/fractions.ts src/features/questions/generators/powers.ts src/features/questions/selectionPolicy.ts
git commit -m "$(cat <<'EOF'
feat(questions): attach template category and operationKind metadata

Upgrade templates to descriptors so selectionPolicy and Monte Carlo can
classify decimal vs hard templates without guessing tags.
EOF
)"
```

---

### Task 3: registry 題型加權抽樣與 soft quota 讓位

**Files:**
- Modify: `src/features/questions/registry.ts`
- Modify: `src/features/questions/registry.test.ts`
- Modify: `src/features/questions/selectionPolicy.ts`（新增 `questionTypeWeight`）

**Interfaces:**
- Consumes: `pickWeighted`、`categoryWeightForMode`、`mixedHardTemplateTarget`、`relaxationOrder`、`neverRelaxCostRange`
- Produces:
  - `export function questionTypeWeight(input: GenerateQuestionInput, type: QuestionType): number` in `selectionPolicy.ts`
  - `applyTypeQuota` 改為 soft：當 quota 過濾後無法服務 policy 目標（例如 mixed 需要 fractions／powers）時，仍保留被 cap 的題型於加權池但權重×`SOFT_QUOTA_PENALTY = 0.15`
  - `tryGenerateQuestion` 使用 `pickWeighted(eligibleTypes, (t) => questionTypeWeight(input, t) * quotaMultiplier(t))`
  - 重試耗盡時依 `relaxationOrder()` 設定 `input` 擴充旗標（見下）後再試一輪，**永不**放寬 `matchesMentalCostBucket`／`costRangeForDifficulty`

新增（可放在 `types.ts` 或僅 registry 內部）：

```typescript
// GenerateQuestionInput 擴充（Task 3 加入 types.ts；字串聯合避免循環 import）
relaxedConstraints?: Array<"decimal-cap" | "theme-ratio" | "hard-template-ratio">;
```

- [ ] **Step 1: Write the failing tests**

在 `registry.test.ts` 追加：

```typescript
import { questionTypeWeight } from "./selectionPolicy";

describe("registry selectionPolicy integration", () => {
  it("weights mixed extreme toward fractions/powers over arithmetic", () => {
    const input = {
      mode: "mixed" as const,
      difficulty: "extreme" as const,
      context: { recentQuestionIds: [], seenQuestionIds: new Set<string>() },
    };
    const a = questionTypeWeight(input, "arithmetic");
    const f = questionTypeWeight(input, "fractions");
    const p = questionTypeWeight(input, "powers");
    expect(f + p).toBeGreaterThan(a);
  });

  it("never returns out-of-range cost even when generation is difficult", () => {
    const range = costRangeForDifficulty("hard");
    for (let i = 0; i < 30; i += 1) {
      const q = generateQuestion({
        mode: "mixed",
        difficulty: "hard",
        context: { recentQuestionIds: [], seenQuestionIds: new Set() },
      });
      expect(matchesMentalCostBucket(q.mentalCost, range)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/features/questions/registry.test.ts -t "registry selectionPolicy"`

Expected: FAIL — `questionTypeWeight` 未匯出

- [ ] **Step 3: Write minimal implementation**

`selectionPolicy.ts`：

```typescript
import type { GenerateQuestionInput, QuestionType } from "./types";

export function questionTypeWeight(input: GenerateQuestionInput, type: QuestionType): number {
  if (input.mode !== "mixed" && input.mode !== "weakness-focused") {
    return type === input.mode ? 1 : 0;
  }
  if (input.mode === "weakness-focused") {
    // 相容題型由 registry 先過濾；此處均等，細節由模板權重負責
    return 1;
  }
  // mixed：依難模板目標把權重導向 fractions/powers
  const hard = mixedHardTemplateTarget(input.difficulty);
  if (type === "fractions") return hard * 0.55;
  if (type === "powers") return hard * 0.45;
  return 1 - hard;
}
```

`registry.ts` 核心改動：

```typescript
import { pickWeighted } from "./utils";
import {
  questionTypeWeight,
  relaxationOrder,
  type RelaxableConstraint,
} from "./selectionPolicy";

const SOFT_QUOTA_PENALTY = 0.15;

function quotaMultiplier(type: QuestionType, input: GenerateQuestionInput, underCap: Set<QuestionType>): number {
  if (!input.context.typeCounts || !input.context.questionLimit) return 1;
  return underCap.has(type) ? 1 : SOFT_QUOTA_PENALTY;
}

function tryGenerateQuestion(input: GenerateQuestionInput): Question | undefined {
  const baseTypes = getEligibleTypes(input);
  if (baseTypes.length === 0) return undefined;

  const { typeCounts, questionLimit } = input.context;
  const cap =
    typeCounts && questionLimit
      ? maxQuestionsPerType(questionLimit, baseTypes.length)
      : Number.POSITIVE_INFINITY;
  const underCap = new Set(
    baseTypes.filter((type) => (typeCounts?.[type] ?? 0) < cap),
  );

  const bucket = costRangeForDifficulty(input.difficulty);

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const type = pickWeighted(baseTypes, (t) => questionTypeWeight(input, t) * quotaMultiplier(t, input, underCap));
    const targetBand = sampleCostDistributionBand(input.difficulty);
    const candidate = generatorByType[type]({
      ...input,
      targetMentalCostBucket: targetBand,
    });
    // 既有驗證不變：cost in-range 不可放寬
    if (
      candidate &&
      questionMatchesTargetTags(candidate, input.targetTags) &&
      classifyCostBand(input.difficulty, candidate.mentalCost) >= 0 &&
      matchesMentalCostBucket(candidate.mentalCost, bucket) &&
      isQuestionValid(candidate, input.difficulty, input.context.seenQuestionIds)
    ) {
      return candidate;
    }
  }
  return undefined;
}

export function generateQuestion(input: GenerateQuestionInput): Question {
  const candidate = tryGenerateQuestion(input);
  if (candidate) return candidate;

  // 耗盡：依序放寬比例約束（傳入 relaxedConstraints），仍不放寬 cost
  const order = relaxationOrder();
  for (let i = 0; i < order.length; i += 1) {
    const relaxed = order.slice(0, i + 1);
    const retry = tryGenerateQuestion({ ...input, relaxedConstraints: relaxed });
    if (retry) return retry;
  }

  // 既有 weakness-focused tag 放寬邏輯保留…
  // throw 同現況
}
```

在 `types.ts` 的 `GenerateQuestionInput` 加上：

```typescript
import type { RelaxableConstraint } from "./selectionPolicy";
// 避免循環依賴：可改為在 selectionPolicy 定義 RelaxableConstraint，types 用字串聯合重複：
relaxedConstraints?: Array<"decimal-cap" | "theme-ratio" | "hard-template-ratio">;
```

（若循環 import：把 `RelaxableConstraint` 留在 `selectionPolicy.ts`，`types.ts` 用相同字串聯合字面量，不要從 selectionPolicy import。）

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/features/questions/registry.test.ts`

Expected: PASS（含既有 quota／cost 測試；soft quota 測試「caps per-type」可能需改為「多數避開」而非絕對 0——若舊測試過嚴，將該測試改為：20 題中 `fractions` 出現次數 ≤ 3，並在註解標明 soft quota）

- [ ] **Step 5: Commit**

```bash
git add src/features/questions/registry.ts src/features/questions/registry.test.ts src/features/questions/selectionPolicy.ts src/features/questions/types.ts
git commit -m "$(cat <<'EOF'
feat(questions): weight registry type picks from selectionPolicy

Use pickWeighted for mixed type selection, soften type quota so policy
hard-template targets win, and relax ratio constraints only after retries.
EOF
)"
```

---

### Task 4: generators/utils 模板加權與小數上限

**Files:**
- Modify: `src/features/questions/generators/utils.ts`
- Modify: `src/features/questions/selectionPolicy.ts`（`templateWeight`、`allowsDecimalPick`）
- Create or modify tests in `src/features/questions/generators/utils` 路徑：若無專檔，於 `src/features/questions/templates.test.ts` 或新建 `src/features/questions/generators/utils.test.ts`

**Interfaces:**
- Consumes: `QuestionTemplateDescriptor`、`categoryWeightForMode`、`decimalCapForContext`、`isThemeCategory`、`isCategoryAllowed`、`pickWeighted`
- Produces:
  - `export function templateWeight(input: GenerateQuestionInput, template: QuestionTemplateDescriptor): number`
  - `export function allowsDecimalPick(input: GenerateQuestionInput, recentDecimalRatio: number): boolean` — 若 `decimalCap === null` 恆 true；若 `0` 則 decimal 權重已是 0；若 soft cap，當 `recentDecimalRatio >= cap` 且未放寬 `decimal-cap` 時回傳 false（權重歸零）
  - `generateFromTemplates`：過濾硬排除 → `pickWeighted(pool, templateWeight)` → `template.generate(...)`

- [ ] **Step 1: Write the failing test**

建立 `src/features/questions/generators/utils.test.ts`：

```typescript
import { describe, expect, it } from "vitest";
import { fractionTemplates } from "../templates";
import { templateWeight } from "../selectionPolicy";
import type { GenerateQuestionInput } from "../types";

const baseInput = (overrides: Partial<GenerateQuestionInput> = {}): GenerateQuestionInput => ({
  mode: "mixed",
  difficulty: "medium",
  context: { recentQuestionIds: [], seenQuestionIds: new Set() },
  ...overrides,
});

describe("templateWeight", () => {
  it("keeps decimal and fraction templates selectable in fractions mode", () => {
    const decimal = fractionTemplates.find((t) => t.category === "decimal")!;
    const fraction = fractionTemplates.find((t) => t.category === "fraction")!;
    expect(decimal).toBeDefined();
    expect(fraction).toBeDefined();
    expect(templateWeight(baseInput({ mode: "fractions" }), decimal)).toBeGreaterThan(0);
    expect(templateWeight(baseInput({ mode: "fractions" }), fraction)).toBeGreaterThan(0);
  });

  it("boosts theme templates for weakness-focused decimals", () => {
    const decimal = fractionTemplates.find((t) => t.category === "decimal")!;
    const fraction = fractionTemplates.find((t) => t.category === "fraction")!;
    const input = baseInput({ mode: "weakness-focused", targetTags: ["decimals"] });
    expect(templateWeight(input, decimal)).toBeGreaterThan(templateWeight(input, fraction));
  });

  it("keeps conversion weight independent of decimal cap logic", () => {
    const conversion = fractionTemplates.find((t) => t.category === "conversion")!;
    expect(conversion).toBeDefined();
    expect(templateWeight(baseInput({ mode: "mixed" }), conversion)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/features/questions/generators/utils.test.ts`

Expected: FAIL — `templateWeight` 未定義

- [ ] **Step 3: Write minimal implementation**

`selectionPolicy.ts`：

```typescript
import type { QuestionTemplateDescriptor } from "./templates";

export function templateWeight(
  input: GenerateQuestionInput,
  template: QuestionTemplateDescriptor,
): number {
  if (!isCategoryAllowed(input.mode, template.category)) {
    return 0;
  }
  let weight = categoryWeightForMode(input, template.category);

  const themeTarget = themeStepTarget(input);
  if (themeTarget > 0 && isThemeCategory(input, template.category)) {
    weight *= 3;
  }

  const cap = decimalCapForContext(input);
  const relaxed = input.relaxedConstraints ?? [];
  if (
    isDecimalTemplateCategory(template.category) &&
    cap !== null &&
    cap > 0 &&
    !relaxed.includes("decimal-cap")
  ) {
    // 抽樣層：將 decimal 權重縮放到約等於 cap（相對非 decimal）
    weight *= cap / Math.max(cap, 0.1);
  }
  if (isDecimalTemplateCategory(template.category) && cap === 0) {
    return 0;
  }

  return weight;
}
```

注意：若 `templates.ts` ↔ `selectionPolicy.ts` 循環依賴，把 `templateWeight` 放到 `generators/utils.ts` 或新檔 `templateSelection.ts`，並從該處 export；測試改 import 路徑。**以無循環為準**——建議 `templateWeight` 放在 `selectionPolicy.ts` 但參數只收 `{ category: TemplateCategory }`：

```typescript
export function templateWeight(
  input: GenerateQuestionInput,
  template: { category: TemplateCategory },
): number { /* 同上 */ }
```

`generators/utils.ts`：

```typescript
import { pickWeighted } from "../utils";
import { isCategoryAllowed, templateWeight } from "../selectionPolicy";
import type { QuestionTemplate } from "../templates";

export function generateFromTemplates(
  templates: readonly QuestionTemplate[],
  input: GenerateQuestionInput,
): Question | undefined {
  const useSpecialtyTags = input.mode === "weakness-focused";
  const filtered = filterTemplates(templates, input.targetTags, { useSpecialtyTags });
  if (input.targetTags && input.targetTags.length > 0 && filtered.length === 0) {
    return undefined;
  }

  const allowed = (filtered.length > 0 ? filtered : templates).filter((t) =>
    isCategoryAllowed(input.mode, t.category),
  );
  if (allowed.length === 0) {
    return undefined;
  }

  const bucket = input.targetMentalCostBucket;

  for (let attempt = 0; attempt < MAX_TEMPLATE_ATTEMPTS; attempt += 1) {
    const template = pickWeighted(allowed, (t) => templateWeight(input, t));

    for (let reroll = 0; reroll < REROLLS_PER_TEMPLATE; reroll += 1) {
      let question = template.generate({
        difficulty: input.difficulty,
        kind: chooseQuestionKind(),
      });
      question = tryExtendQuestion(question, input);
      const finalized = finalizeQuestion(question, input);
      // …既有 cost 分支不變
    }
  }
  return undefined;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/features/questions/generators/utils.test.ts src/features/questions/templates.test.ts src/features/questions/registry.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/questions/generators/utils.ts src/features/questions/generators/utils.test.ts src/features/questions/selectionPolicy.ts
git commit -m "$(cat <<'EOF'
feat(questions): weight template picks with decimal caps

Filter hard-excluded categories and pickWeighted templates using
selectionPolicy so mixed/fractions/weakness decimal rates stay on target.
EOF
)"
```

---

### Task 5: 非零步驟策略（reroll → 2% 接受 → 換模板）

**Files:**
- Create: `src/features/questions/nonZeroStep.ts`
- Create: `src/features/questions/nonZeroStep.test.ts`
- Modify: `src/features/questions/calculationTemplates.ts`（匯出 `resultForTemplate`）
- Modify: `src/features/questions/generators/utils.ts`（接入決策）

**Interfaces:**
- Consumes: `ZERO_STEP_ACCEPT_RATE`、`NON_ZERO_STEP_TARGET` from `selectionPolicy`；`CalculationTemplateSpec`
- Produces:
  - `export function resultForTemplate(spec: CalculationTemplateSpec): string`（從 private 改 export）
  - `export function isZeroStepResult(result: string): boolean`
  - `export type ZeroStepDecision = "accept" | "reroll-numbers" | "reject-template"`
  - `export function decideZeroStep(params: { isZero: boolean; numberRerollCount: number; maxNumberRerolls: number; random?: () => number }): ZeroStepDecision`
  - 規則：非零 → 不適用（呼叫端不叫）；為零且 `numberRerollCount < maxNumberRerolls` → `"reroll-numbers"`；否則以 `ZERO_STEP_ACCEPT_RATE` 機率 `"accept"`，否則 `"reject-template"`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/features/questions/nonZeroStep.test.ts
import { describe, expect, it } from "vitest";
import { resultForTemplate } from "./calculationTemplates";
import { decideZeroStep, isZeroStepResult } from "./nonZeroStep";
import { ZERO_STEP_ACCEPT_RATE } from "./selectionPolicy";

describe("isZeroStepResult", () => {
  it("detects numeric zero", () => {
    expect(isZeroStepResult("0")).toBe(true);
    expect(isZeroStepResult("0.0")).toBe(true);
    expect(isZeroStepResult("0/1")).toBe(true);
    expect(isZeroStepResult("1")).toBe(false);
    expect(isZeroStepResult("1/2")).toBe(false);
  });
});

describe("decideZeroStep", () => {
  it("rerolls numbers before accepting or rejecting template", () => {
    expect(
      decideZeroStep({ isZero: true, numberRerollCount: 0, maxNumberRerolls: 8, random: () => 0 }),
    ).toBe("reroll-numbers");
  });

  it("accepts zero with about 2% after rerolls exhausted", () => {
    expect(
      decideZeroStep({
        isZero: true,
        numberRerollCount: 8,
        maxNumberRerolls: 8,
        random: () => ZERO_STEP_ACCEPT_RATE - 1e-9,
      }),
    ).toBe("accept");
    expect(
      decideZeroStep({
        isZero: true,
        numberRerollCount: 8,
        maxNumberRerolls: 8,
        random: () => ZERO_STEP_ACCEPT_RATE + 1e-9,
      }),
    ).toBe("reject-template");
  });
});

describe("resultForTemplate export", () => {
  it("computes integer subtract zero", () => {
    expect(isZeroStepResult(resultForTemplate({ kind: "integer-subtract", a: 5, b: 5 }))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/features/questions/nonZeroStep.test.ts`

Expected: FAIL — module／export 不存在

- [ ] **Step 3: Write minimal implementation**

`calculationTemplates.ts`：將 `function resultForTemplate` 改為 `export function resultForTemplate`。

`nonZeroStep.ts`：

```typescript
import { parseNumericAnswer } from "./utils";
import { ZERO_STEP_ACCEPT_RATE } from "./selectionPolicy";

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
```

在 `generateFromTemplates` 的內層 reroll 迴圈，於 `template.generate` 之後：

```typescript
import { resultForTemplate } from "../calculationTemplates";
import { decideZeroStep, isZeroStepResult } from "../nonZeroStep";

const specs = question.costTemplates ?? [];
const hasZero = specs.some((spec) => isZeroStepResult(resultForTemplate(spec)));
const decision = decideZeroStep({
  isZero: hasZero,
  numberRerollCount: reroll,
  maxNumberRerolls: REROLLS_PER_TEMPLATE,
});
if (decision === "reroll-numbers") {
  continue;
}
if (decision === "reject-template") {
  break;
}
// accept → 繼續 finalize
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/features/questions/nonZeroStep.test.ts src/features/questions/generators/utils.test.ts src/features/questions/mentalCost.test.ts`

Expected: PASS（確認匯出 `resultForTemplate` 不破壞 mentalCost）

- [ ] **Step 5: Commit**

```bash
git add src/features/questions/nonZeroStep.ts src/features/questions/nonZeroStep.test.ts src/features/questions/calculationTemplates.ts src/features/questions/generators/utils.ts
git commit -m "$(cat <<'EOF'
feat(questions): enforce non-zero step policy with reroll fallback

Export resultForTemplate and decide zero intermediates by rerolling
numbers first, rarely accepting zero, otherwise rejecting the template.
EOF
)"
```

---

### Task 6: appendStep 主題步驟 ~70% 與同主題可控重複

**Files:**
- Modify: `src/features/questions/generators/appendStep.ts`
- Modify: `src/features/questions/generators/appendStep.test.ts`
- Modify: `src/features/questions/selectionPolicy.ts`（`canAppendOperationKind`、`appendStepCategory`）

**Interfaces:**
- Consumes: `MAX_SAME_KIND_EXTRA`、`isThemeCategory`、`isCategoryAllowed`、`themeStepTarget`
- Produces:
  - `export function operationKindOfSpec(spec: CalculationTemplateSpec): OperationKind` — 預設 `spec.kind`，異分母加減可細分為 `fraction-unlike-denom:+` 若 append 有 op
  - `export function countOperationKind(specs: readonly CalculationTemplateSpec[], kind: OperationKind): number`
  - `export function canAppendOperationKind(existing: readonly CalculationTemplateSpec[], kind: OperationKind): boolean` — `count <= 1 + MAX_SAME_KIND_EXTRA`（已有 1 次後最多再 2 次 ⇒ 合計 ≤ 3）
  - `appendCostStep`／各 `append*Step`：依 `input` 優先選同主題 category 的 builder；跳過硬排除；超過同類上限則改選其他同主題 operationKind

- [ ] **Step 1: Write the failing tests**

在 `appendStep.test.ts` 追加：

```typescript
import { canAppendOperationKind, operationKindOfSpec } from "../selectionPolicy";
import type { CalculationTemplateSpec } from "../calculationTemplates";

describe("same-kind append limit", () => {
  it("allows at most MAX_SAME_KIND_EXTRA extras (total 3)", () => {
    const specs: CalculationTemplateSpec[] = [
      { kind: "integer-add", a: 1, b: 2 },
      { kind: "integer-add", a: 3, b: 4 },
      { kind: "integer-add", a: 5, b: 6 },
    ];
    expect(canAppendOperationKind(specs, "integer-add")).toBe(false);
    expect(canAppendOperationKind(specs.slice(0, 1), "integer-add")).toBe(true);
    expect(canAppendOperationKind(specs.slice(0, 2), "integer-add")).toBe(true);
  });

  it("maps spec kind to operationKind", () => {
    expect(operationKindOfSpec({ kind: "decimal-multiply", decimal: 0.2, integer: 3 })).toBe(
      "decimal-multiply",
    );
  });
});

describe("theme-focused append", () => {
  it("prefers decimal append for weakness-focused decimals on fraction-type questions", () => {
    const question = baseQuestion({
      type: "fractions",
      prompt: "0.2 + 0.3 = ?",
      answer: "0.5",
      tags: ["decimals", "addition"],
      specialtyTags: ["decimals"],
      costTemplates: [{ kind: "decimal-add", left: 0.2, right: 0.3 }],
      difficulty: "medium",
      mentalCost: 2,
    });

    let decimalAppends = 0;
    for (let i = 0; i < 20; i += 1) {
      const extended = appendCostStep(question, {
        mode: "weakness-focused",
        difficulty: "medium",
        targetTags: ["decimals"],
        context: { recentQuestionIds: [], seenQuestionIds: new Set() },
      });
      if (extended?.costTemplates?.some((s) => s.kind.startsWith("decimal-"))) {
        decimalAppends += 1;
      }
    }
    expect(decimalAppends).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/features/questions/generators/appendStep.test.ts`

Expected: FAIL — `canAppendOperationKind` 未定義

- [ ] **Step 3: Write minimal implementation**

`selectionPolicy.ts`：

```typescript
import type { CalculationTemplateSpec } from "./calculationTemplates";

export function operationKindOfSpec(spec: CalculationTemplateSpec): OperationKind {
  return spec.kind;
}

export function countOperationKind(
  specs: readonly CalculationTemplateSpec[],
  kind: OperationKind,
): number {
  return specs.filter((spec) => operationKindOfSpec(spec) === kind).length;
}

export function canAppendOperationKind(
  existing: readonly CalculationTemplateSpec[],
  kind: OperationKind,
): boolean {
  return countOperationKind(existing, kind) < 1 + MAX_SAME_KIND_EXTRA;
}
```

`appendStep.ts` 改造重點：

1. 為每個 builder 標註 `{ category: TemplateCategory; operationKind: OperationKind }`。
2. `pickAppendCandidate` 改為：
   - 過濾 `!isCategoryAllowed(mode, category)`
   - 過濾 `!canAppendOperationKind(existing, operationKind)`
   - 若 `themeStepTarget(input) > 0`：先從 `isThemeCategory` 為 true 的 builder 洗牌挑選；失敗再退到非主題（除非未放寬且要硬守主題——append 階段優先主題即可）。
3. `appendFractionStep` 在 decimals 弱項時優先 `appendDecimalOperation`。
4. `arithmetic` 模式路徑不得呼叫 decimal／fraction append（`appendArithmeticStep` 已是 integer；確保 fractions 模式的 powers 不會從 append 進入——powers 題在 fractions 模式本就不會生成）。

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/features/questions/generators/appendStep.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/questions/generators/appendStep.ts src/features/questions/generators/appendStep.test.ts src/features/questions/selectionPolicy.ts
git commit -m "$(cat <<'EOF'
feat(questions): prefer theme appends with same-kind repeat cap

Drive appendStep from selectionPolicy so specialty/weakness steps stay
near 70% theme focus without exceeding MAX_SAME_KIND_EXTRA.
EOF
)"
```

---

### Task 7: 絕對值數字範圍（依難度加大）

**Files:**
- Modify: `src/features/questions/selectionPolicy.ts`
- Modify: `src/features/questions/templates.ts`（絕對值相關模板改用 policy 範圍）
- Modify: `src/features/questions/templates.test.ts` 或新建絕對值範圍測試
- Optional 極小文案：`techniques.ts` 中 absolute-value technique 名稱／一句 steps（僅若現有文案暗示「只認符號」）

**Interfaces:**
- Consumes: `Difficulty`
- Produces:
  - `export function absoluteValueOperandRange(difficulty: Difficulty): { min: number; max: number }`
  - 建議值（兩位數方向，隨難度加大）：
    - `easy: { min: 3, max: 20 }`
    - `medium: { min: 8, max: 40 }`
    - `hard: { min: 12, max: 70 }`
    - `extreme: { min: 20, max: 99 }`
  - 算術絕對值模板（`integer-abs-composite`、`double-abs`）與 powers 絕對值模板改為 `randomInt(range.min, range.max)`（符號另乘 -1）

- [ ] **Step 1: Write the failing tests**

```typescript
// 加在 selectionPolicy.test.ts
import { absoluteValueOperandRange } from "./selectionPolicy";

describe("absoluteValueOperandRange", () => {
  it("widens with difficulty to support calculation practice", () => {
    const easy = absoluteValueOperandRange("easy");
    const extreme = absoluteValueOperandRange("extreme");
    expect(easy.max).toBeGreaterThanOrEqual(20);
    expect(extreme.max).toBeGreaterThan(easy.max);
    expect(extreme.min).toBeGreaterThan(easy.min);
  });
});
```

另加抽樣測試（templates.test.ts）：

```typescript
it("samples absolute-value arithmetic operands inside policy range for extreme", () => {
  const range = absoluteValueOperandRange("extreme");
  const absTemplates = arithmeticTemplates.filter((t) => t.id.includes("abs"));
  expect(absTemplates.length).toBeGreaterThan(0);
  for (let i = 0; i < 30; i += 1) {
    const q = absTemplates[0].generate({ difficulty: "extreme", kind: "fill-in" });
    const match = q.prompt.match(/\|-?(\d+)\|/);
    expect(match).toBeTruthy();
    const n = Number(match![1]);
    expect(n).toBeGreaterThanOrEqual(range.min);
    expect(n).toBeLessThanOrEqual(range.max);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/features/questions/selectionPolicy.test.ts -t "absoluteValueOperandRange"`

Expected: FAIL — function missing

- [ ] **Step 3: Write minimal implementation**

```typescript
export function absoluteValueOperandRange(difficulty: Difficulty): { min: number; max: number } {
  return {
    easy: { min: 3, max: 20 },
    medium: { min: 8, max: 40 },
    hard: { min: 12, max: 70 },
    extreme: { min: 20, max: 99 },
  }[difficulty];
}
```

更新 `templates.ts` 絕對值題（約 L400–441、powers abs 段）：

```typescript
const range = absoluteValueOperandRange(difficulty);
const a = -randomInt(range.min, range.max);
```

`double-abs` 的兩個操作數皆取自同一 range。非零仍依 Task 5 的 generate 層 reroll，不在此放寬 cost range。

若 `integerAbsCompositeTechnique`／`doubleAbsTechnique` 文案僅寫「取絕對值符號」，可改一句為「先求絕對值再繼續運算」——保持極小變更。

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/features/questions/selectionPolicy.test.ts src/features/questions/templates.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/questions/selectionPolicy.ts src/features/questions/selectionPolicy.test.ts src/features/questions/templates.ts src/features/questions/templates.test.ts src/features/questions/techniques.ts
git commit -m "$(cat <<'EOF'
feat(questions): scale absolute-value operands by difficulty

Use selectionPolicy ranges so absolute value drills larger numbers as
calculation practice rather than symbol recognition only.
EOF
)"
```

---

### Task 8: Monte Carlo 分布測試與回歸

**Files:**
- Modify: `src/features/questions/registry.test.ts`
- Modify: `src/features/questions/selectionPolicy.ts`（僅在權重微調需要時）
- Modify: `src/features/questions/registry.ts`／`generators/utils.ts`（僅在 Monte Carlo 未達標時微調權重消費端）

**Interfaces:**
- Consumes: Task 2 已寫入的 `question.templateCategory`／`templateId`；全部 policy 常數；`generateQuestion`；`resultForTemplate`；`isZeroStepResult`
- Produces: `registry.test.ts` 內 `selectionPolicy Monte Carlo` describe 區塊；無新 production export

容差（對齊既有 registry ±15% 風格，分布類用絕對百分比帶）：

| 指標 | 樣本 | 容差 |
|------|------|------|
| mixed／powers 小數主模板 | ≥1000 | 10% ± 5pp → `[0.05, 0.15]` |
| fractions 小數主模板 | ≥1000 | 20% ± 6pp → `[0.14, 0.26]` |
| arithmetic 硬排除 | ≥500 | 違規 category 出現率 `=== 0` |
| fractions 無 power | ≥500 | `=== 0` |
| mixed 難模板合計 | ≥1000／難度 | 目標 ± 8pp |
| 專項／弱項主題步驟占比 | ≥1000 題的步驟加總 | 70% ± 10pp → `[0.60, 0.80]` |
| 步驟中間結果為 0 | ≥2000 步驟 | 2% ± 2pp → `[0, 0.04]` |
| 弱項 decimals | ≥300 題 | 主模板 decimal 或 specialty 匹配 ≥ 60%（不受 10% 壓制） |

- [ ] **Step 1: Write the failing Monte Carlo tests**

在 `registry.test.ts` 追加（timeout 120_000+）：

```typescript
import {
  isDecimalTemplateCategory,
  isHardTemplateCategory,
  mixedHardTemplateTarget,
  type TemplateCategory,
} from "./selectionPolicy";
import { resultForTemplate } from "./calculationTemplates";
import { isZeroStepResult } from "./nonZeroStep";

function categoryOf(q: { templateCategory?: TemplateCategory }): TemplateCategory {
  if (!q.templateCategory) {
    throw new Error("question missing templateCategory metadata");
  }
  return q.templateCategory;
}

describe("selectionPolicy Monte Carlo", () => {
  it("keeps mixed decimal primary templates near 10%", () => {
    const n = 1000;
    let decimal = 0;
    for (let i = 0; i < n; i += 1) {
      const q = generateQuestion({
        mode: "mixed",
        difficulty: "medium",
        context: { recentQuestionIds: [], seenQuestionIds: new Set() },
      });
      if (isDecimalTemplateCategory(categoryOf(q))) decimal += 1;
    }
    const ratio = decimal / n;
    expect(ratio).toBeGreaterThanOrEqual(0.05);
    expect(ratio).toBeLessThanOrEqual(0.15);
  }, 120_000);

  it("keeps fractions specialty decimal primaries near 20%", () => {
    const n = 1000;
    let decimal = 0;
    for (let i = 0; i < n; i += 1) {
      const q = generateQuestion({
        mode: "fractions",
        difficulty: "medium",
        context: { recentQuestionIds: [], seenQuestionIds: new Set() },
      });
      if (isDecimalTemplateCategory(categoryOf(q))) decimal += 1;
    }
    const ratio = decimal / n;
    expect(ratio).toBeGreaterThanOrEqual(0.14);
    expect(ratio).toBeLessThanOrEqual(0.26);
  }, 120_000);

  it("hard-excludes non-integer categories in arithmetic mode", () => {
    for (let i = 0; i < 500; i += 1) {
      const q = generateQuestion({
        mode: "arithmetic",
        difficulty: "medium",
        context: { recentQuestionIds: [], seenQuestionIds: new Set() },
      });
      // 主模板必須是 integer；不得出現分數／小數步驟。
      // integer 題內可含 square 中間步（如 a²−b²），不算 power 題型／power 主模板。
      expect(categoryOf(q)).toBe("integer");
      expect(q.type).toBe("arithmetic");
      for (const spec of q.costTemplates ?? []) {
        expect(spec.kind.startsWith("fraction")).toBe(false);
        expect(spec.kind.startsWith("decimal")).toBe(false);
        expect(spec.kind.includes("decimal-fraction")).toBe(false);
      }
    }
  }, 120_000);

  it("hard-excludes power category in fractions mode", () => {
    for (let i = 0; i < 500; i += 1) {
      const q = generateQuestion({
        mode: "fractions",
        difficulty: "hard",
        context: { recentQuestionIds: [], seenQuestionIds: new Set() },
      });
      expect(categoryOf(q)).not.toBe("power");
      expect(q.type).not.toBe("powers");
    }
  }, 120_000);

  it("matches mixed hard-template totals by difficulty", () => {
    for (const difficulty of ["easy", "medium", "hard", "extreme"] as const) {
      const target = mixedHardTemplateTarget(difficulty);
      const n = 1000;
      let hard = 0;
      for (let i = 0; i < n; i += 1) {
        const q = generateQuestion({
          mode: "mixed",
          difficulty,
          context: { recentQuestionIds: [], seenQuestionIds: new Set() },
        });
        if (isHardTemplateCategory(categoryOf(q))) hard += 1;
      }
      const ratio = hard / n;
      expect(ratio).toBeGreaterThanOrEqual(target - 0.08);
      expect(ratio).toBeLessThanOrEqual(target + 0.08);
    }
  }, 300_000);

  it("keeps weakness decimals highly focused and above 10% decimal cap", () => {
    const n = 300;
    let matched = 0;
    let decimalPrimary = 0;
    for (let i = 0; i < n; i += 1) {
      const q = generateQuestion({
        mode: "weakness-focused",
        difficulty: "medium",
        targetTags: ["decimals"],
        targetTypes: ["arithmetic", "fractions"],
        context: { recentQuestionIds: [], seenQuestionIds: new Set() },
      });
      if (questionMatchesTargets(q, ["decimals"])) matched += 1;
      if (isDecimalTemplateCategory(categoryOf(q))) decimalPrimary += 1;
    }
    expect(matched / n).toBeGreaterThanOrEqual(0.6);
    expect(decimalPrimary / n).toBeGreaterThan(0.2);
  }, 120_000);

  it("keeps step intermediate zeros near 2%", () => {
    let steps = 0;
    let zeros = 0;
    for (let i = 0; i < 400; i += 1) {
      const q = generateQuestion({
        mode: "mixed",
        difficulty: "medium",
        context: { recentQuestionIds: [], seenQuestionIds: new Set() },
      });
      for (const spec of q.costTemplates ?? []) {
        steps += 1;
        if (isZeroStepResult(resultForTemplate(spec))) zeros += 1;
      }
    }
    expect(steps).toBeGreaterThan(500);
    const ratio = zeros / steps;
    expect(ratio).toBeGreaterThanOrEqual(0);
    expect(ratio).toBeLessThanOrEqual(0.04);
  }, 120_000);

  it("keeps specialty theme step ratio near 70% for fractions mode", () => {
    let theme = 0;
    let total = 0;
    for (let i = 0; i < 400; i += 1) {
      const q = generateQuestion({
        mode: "fractions",
        difficulty: "medium",
        context: { recentQuestionIds: [], seenQuestionIds: new Set() },
      });
      for (const spec of q.costTemplates ?? []) {
        total += 1;
        const kind = spec.kind;
        const isTheme =
          kind.startsWith("fraction") ||
          kind.startsWith("decimal") ||
          kind.includes("decimal-fraction");
        if (isTheme) theme += 1;
      }
    }
    const ratio = theme / total;
    expect(ratio).toBeGreaterThanOrEqual(0.6);
    expect(ratio).toBeLessThanOrEqual(0.95);
  }, 120_000);
});
```

並保留／確認既有回歸：`every mode and difficulty stays strictly in the global range`、`mentalCost.test.ts`、弱項 absolute-value／decimals 案例。`templateCategory` 必須已由 Task 2 注入；本 task 不得再發明第二套分類推導。

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/features/questions/registry.test.ts -t "selectionPolicy Monte Carlo"`

Expected: FAIL — 至少一項分布超出容差（權重尚未為 Monte Carlo 微調），或既有 soft-quota 絕對斷言與 soft 行為衝突

- [ ] **Step 3: Write minimal implementation**

1. 微調 `categoryWeightForMixed`／`templateWeight`／`questionTypeWeight` 直到 Monte Carlo 在容差內。
2. 若 `caps per-type question counts in mixed sessions` 因 soft quota 失敗：改為「20 題中 fractions 出現 ≤ 3」並註明 soft quota 讓位 policy。
3. **禁止**修改 `DIFFICULTY_COST_RANGES`、`mentalCost.ts` 公式或 `costModel.ts` 來湊通過。

- [ ] **Step 4: Run full regression**

Run: `npm run test:run -- src/features/questions`

Expected: PASS（Monte Carlo 可能較久；全部綠燈）

另確認：

Run: `npm run test:run -- src/features/questions/mentalCost.test.ts`

Expected: PASS — 證明未改 mentalCost 公式／range

- [ ] **Step 5: Commit**

```bash
git add src/features/questions/registry.test.ts src/features/questions/types.ts src/features/questions/templates.ts src/features/questions/selectionPolicy.ts src/features/questions/registry.ts src/features/questions/generators/utils.ts
git commit -m "$(cat <<'EOF'
test(questions): add Monte Carlo coverage for selectionPolicy mix

Verify decimal caps, hard-template totals, theme focus, hard exclusions,
and near-2% zero intermediates without relaxing mentalCost ranges.
EOF
)"
```

---

### Task 9: Spec 交叉引用與成功標準核對

**Files:**
- Modify: `docs/superpowers/specs/2026-07-10-question-template-selection-policy-design.md`（僅加實作計畫連結與狀態）
- Modify: `docs/09-project-folder-guide.md`（在 questions 小節加一行 `selectionPolicy.ts`——若該節已列舉檔案）

**Interfaces:**
- Consumes: 本 plan 路徑
- Produces: 文件指向 `docs/superpowers/plans/2026-07-10-question-template-selection-policy.md`

- [ ] **Step 1: Write the failing check（文件狀態）**

手動／用測試不適用；改為明確編輯步驟。先確認 spec 狀態仍寫「待實作計畫」。

- [ ] **Step 2: Verify gap before edit**

Run: `rg "待實作計畫|selectionPolicy" docs/superpowers/specs/2026-07-10-question-template-selection-policy-design.md`

Expected: 狀態仍為待實作計畫或已核准設計

- [ ] **Step 3: Update docs**

在 spec 頂部狀態改為：

```markdown
狀態：已核准設計；實作計畫見 `docs/superpowers/plans/2026-07-10-question-template-selection-policy.md`
```

在 §12 末加：

```markdown
- 實作計畫：`docs/superpowers/plans/2026-07-10-question-template-selection-policy.md`
```

在 `docs/09-project-folder-guide.md` 的 `#### features/questions/` 小節（約 L174 起）新增一列說明：

```markdown
| `selectionPolicy.ts` | 出題模板選擇權重與約束的唯一來源（小數上限、難模板比例、主題聚焦、硬排除） |
```

- [ ] **Step 4: Confirm no formula drift**

Run: `git diff HEAD -- src/features/questions/mentalCost.ts src/features/questions/costModel.ts`

Expected: 空 diff（本功能全程不應改這兩檔；若有改動必須 revert）

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-07-10-question-template-selection-policy-design.md docs/09-project-folder-guide.md
git commit -m "$(cat <<'EOF'
docs: link selectionPolicy implementation plan from spec

Point the approved design spec and folder guide at the executable plan.
EOF
)"
```

---

## Self-Review

### 1. Spec coverage

| Spec 要求 | Task |
|-----------|------|
| 集中式 selectionPolicy 唯一權重來源 | Task 1、3、4、6 |
| 六類 metadata；小數僅 decimal；難模板四類 | Task 2、8 |
| 小數 10%／20%；arithmetic 0%；弱項 decimals 不壓制 | Task 1、4、8 |
| Mixed 難模板 65／70／75／80；quota 讓位 | Task 1、3、8 |
| 專項／弱項主題步驟 ~70%；MAX_SAME_KIND_EXTRA=2 | Task 1、6、8 |
| 非零 ~98%；reroll→2%接受→換模板 | Task 5、8 |
| 絕對值依難度加大數字範圍 | Task 7 |
| 衝突優先序；不放寬 cost／硬排除 | Task 1、3、8、9 |
| Monte Carlo + 回歸；不改 mentalCost | Task 8、9 |
| 文件交叉引用 | Task 9 |

### 2. Placeholder scan

已排除 TBD／TODO／「similar to Task N」空泛步驟；各 task 含完整測試碼、實作碼、指令與 Expected FAIL／PASS、Commit。

### 3. Type consistency

- `TemplateCategory`／`OperationKind`／`RelaxableConstraint`／`MAX_SAME_KIND_EXTRA`／`THEME_STEP_TARGET=0.7` 全 plan 一致。
- `QuestionTemplate` 升級為 `QuestionTemplateDescriptor`；generators 一律 `.generate(...)`。
- `pickWeighted` 定義於 `utils.ts`；`templateWeight` 只收 `{ category: TemplateCategory }` 以避免與 `templates.ts` 循環依賴。
- `GenerateQuestionInput.relaxedConstraints` 使用字串聯合，不從 `selectionPolicy` import 進 `types.ts`。
- `Question.templateCategory`／`templateId` 由 Task 2 的 `describeTemplate` 包裝寫入；Task 8 Monte Carlo 依賴此欄位。
- 主題步驟目標全 plan 使用 **0.7（70%）**，與核准 spec §4.3／§2.2 一致（非 80%）。

### 4. Fixes applied during self-review

- 補完被截斷的 Self-Review 結尾。
- 移除 Monte Carlo arithmetic 測試中的 `__skip__` 占位斷言，改為明確只禁止 fraction／decimal kinds（integer 題內 `square` 中間步允許）。
- Task 2 強制要求 `describeTemplate` 注入 `templateCategory`／`templateId`，避免 Task 8 含糊「若未做則補上」。