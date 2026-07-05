import type { Attempt } from "../../results/types";
import { Button } from "../../../shared/components/Button";
import { formatMilliseconds } from "../../../shared/utils/format";
import styles from "./PracticeComponents.module.css";

interface FeedbackPanelProps {
  attempt: Attempt;
  isLastQuestion: boolean;
  onNext: () => void;
}

export function FeedbackPanel({ attempt, isLastQuestion, onNext }: FeedbackPanelProps) {
  const { technique } = attempt.question;

  return (
    <section
      aria-live="polite"
      className={attempt.isCorrect ? styles.correctFeedback : styles.wrongFeedback}
    >
      <div className={styles.feedbackContent}>
        <div className={styles.feedbackBody}>
          <span aria-hidden="true" className={styles.feedbackIcon}>
            {attempt.isCorrect ? "✓" : "×"}
          </span>
          <div>
            <strong>{attempt.isCorrect ? "答對了" : "答錯了"}</strong>
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

      <Button onClick={onNext}>{isLastQuestion ? "查看統計" : "下一題"}</Button>
    </section>
  );
}
