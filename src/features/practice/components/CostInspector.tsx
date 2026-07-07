import { useState } from "react";
import { describeMentalCost } from "../../questions/calculationTemplates";
import { costRangeForDifficulty, matchesMentalCostBucket } from "../../questions/mentalCost";
import type { Question } from "../../questions/types";
import styles from "./PracticeComponents.module.css";

const STEP_LABELS: Record<string, string> = {
  "integer-add": "整數加法",
  "integer-subtract": "整數減法",
  "integer-multiply": "整數乘法",
  "integer-divide": "整數除法",
  "fraction-add": "分數加法",
  "fraction-subtract": "分數減法",
  "fraction-multiply": "分數乘法",
  "fraction-divide": "分數除法",
  power: "冪次",
  root: "開方",
  "absolute-value": "絕對值",
  "symbolic-simplify": "符號化簡",
  sum: "合併",
};

function formatCost(value: number): string {
  return value.toFixed(1);
}

function stepLabel(label: string): string {
  return STEP_LABELS[label] ?? label;
}

interface CostInspectorProps {
  question: Question;
}

export function CostInspector({ question }: CostInspectorProps) {
  const [open, setOpen] = useState(false);

  const description = describeMentalCost(question.costTemplates ?? [], question.answer);
  const range = costRangeForDifficulty(question.difficulty);
  const inRange = matchesMentalCostBucket(question.mentalCost, range);

  return (
    <div className={styles.costInspector}>
      <button
        aria-expanded={open}
        className={styles.costButton}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        Cost {formatCost(question.mentalCost)}
        <span aria-hidden="true">{open ? " ▲" : " ▼"}</span>
      </button>

      {open ? (
        <div className={styles.costPanel}>
          <div className={styles.costSummaryRow}>
            <span>總 cost</span>
            <strong>{formatCost(question.mentalCost)}</strong>
          </div>
          <div className={styles.costSummaryRow}>
            <span>難度標準範圍</span>
            <span
              className={inRange ? styles.costInRange : styles.costOutRange}
            >
              {range.min}–{range.max}
              {inRange ? "（符合）" : "（超出）"}
            </span>
          </div>

          {description.steps.length > 0 ? (
            <>
              <p className={styles.costStepTitle}>計算過程</p>
              <ul className={styles.costStepList}>
                {description.steps.map((step, index) => (
                  <li className={styles.costStep} key={`${step.label}-${index}`}>
                    <span className={styles.costStepName}>{stepLabel(step.label)}</span>
                    <span className={styles.costStepValue}>
                      內部 {formatCost(step.internalCost)} → {formatCost(step.effectiveCost)}
                    </span>
                  </li>
                ))}
              </ul>
              {description.coordinationOverhead > 0.05 ? (
                <div className={styles.costSummaryRow}>
                  <span>多步驟協調成本</span>
                  <span>+{formatCost(description.coordinationOverhead)}</span>
                </div>
              ) : null}
              {description.memoryCost > 0.05 ? (
                <div className={styles.costSummaryRow}>
                  <span>記憶成本</span>
                  <span>+{formatCost(description.memoryCost)}</span>
                </div>
              ) : null}
            </>
          ) : (
            <p className={styles.costStepTitle}>此題沒有可顯示的計算步驟。</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
