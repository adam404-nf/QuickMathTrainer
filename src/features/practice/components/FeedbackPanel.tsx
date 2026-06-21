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
  return (
    <section className={attempt.isCorrect ? styles.correctFeedback : styles.wrongFeedback}>
      <div>
        <strong>{attempt.isCorrect ? "答對了" : "答錯了"}</strong>
        <p>
          正確答案：{attempt.correctAnswer}，用時 {formatMilliseconds(attempt.timeMs)}
        </p>
      </div>
      <Button onClick={onNext}>{isLastQuestion ? "查看統計" : "下一題"}</Button>
    </section>
  );
}
