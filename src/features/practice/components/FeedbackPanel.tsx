import type { Attempt } from "../../results/types";
import { formatMilliseconds } from "../../../shared/utils/format";
import styles from "./PracticeComponents.module.css";

interface FeedbackPanelProps {
  attempt: Attempt;
}

export function FeedbackPanel({ attempt }: FeedbackPanelProps) {
  const { technique } = attempt.question;
  const feedbackTitle = attempt.revealed ? "已顯示答案" : attempt.isCorrect ? "答對了" : "答錯了";
  const feedbackClass = attempt.revealed
    ? styles.revealedFeedback
    : attempt.isCorrect
      ? styles.correctFeedback
      : styles.wrongFeedback;

  return (
    <section aria-live="polite" className={feedbackClass}>
      <div className={styles.feedbackContent}>
        <div className={styles.feedbackBody}>
          <span aria-hidden="true" className={styles.feedbackIcon}>
            {attempt.revealed ? "…" : attempt.isCorrect ? "✓" : "×"}
          </span>
          <div>
            <strong>{feedbackTitle}</strong>
            <p>
              正確答案：{attempt.correctAnswer}，用時 {formatMilliseconds(attempt.timeMs)}
            </p>
          </div>
        </div>

        <div className={styles.techniqueBlock}>
          <strong className={styles.techniqueTitle}>計算技巧：{technique.name}</strong>
          <ol className={styles.techniqueSteps}>
            {technique.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
