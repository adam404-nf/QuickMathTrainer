import type { Question } from "../../questions/types";
import { getSkillTagLabel } from "../../questions/tags";
import { Card } from "../../../shared/components/Card";
import { CostInspector } from "./CostInspector";
import styles from "./PracticeComponents.module.css";

const DIFFICULTY_LABELS: Record<Question["difficulty"], string> = {
  easy: "基礎",
  medium: "標準",
  hard: "挑戰",
  extreme: "極限",
};

interface QuestionCardProps {
  question: Question;
  currentIndex: number;
  totalQuestions: number;
  modeLabel?: string;
  focusTags?: string[];
}

export function QuestionCard({
  question,
  currentIndex,
  totalQuestions,
  modeLabel,
  focusTags,
}: QuestionCardProps) {
  const progress = Math.min(100, Math.round(((currentIndex + 1) / totalQuestions) * 100));

  return (
    <Card className={styles.questionCard}>
      <div className={styles.questionMeta}>
        <span className={styles.questionCounter}>
          第 {currentIndex + 1} / {totalQuestions} 題
        </span>
        <div className={styles.questionMetaRight}>
          <CostInspector question={question} />
          <span className={styles.difficultyBadge}>{DIFFICULTY_LABELS[question.difficulty]}</span>
        </div>
      </div>

      <div
        aria-label={`進度 ${progress}%`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progress}
        className={styles.progressTrack}
        role="progressbar"
      >
        <span className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      {modeLabel ? <p className={styles.modeBadge}>{modeLabel}</p> : null}

      {focusTags && focusTags.length > 0 ? (
        <p className={styles.focusBanner}>
          正在專攻：{focusTags.map((tag) => getSkillTagLabel(tag)).join("、")}
        </p>
      ) : null}

      <p className={styles.prompt}>{question.prompt}</p>
    </Card>
  );
}
