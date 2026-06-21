import { createSessionSummary } from "../../results/summary";
import type { Attempt } from "../../results/types";
import { Button } from "../../../shared/components/Button";
import { Card } from "../../../shared/components/Card";
import { formatMilliseconds, formatPercent } from "../../../shared/utils/format";
import styles from "./PracticeComponents.module.css";

interface SessionSummaryPanelProps {
  attempts: Attempt[];
  onRestart: () => void;
}

export function SessionSummaryPanel({ attempts, onRestart }: SessionSummaryPanelProps) {
  const summary = createSessionSummary(attempts);

  return (
    <Card className={styles.summaryCard}>
      <p className={styles.eyebrow}>本輪統計</p>
      <h2>練習完成</h2>
      <div className={styles.summaryGrid}>
        <div>
          <strong>{summary.totalQuestions}</strong>
          <span>題數</span>
        </div>
        <div>
          <strong>{formatPercent(summary.accuracy)}</strong>
          <span>正確率</span>
        </div>
        <div>
          <strong>{formatMilliseconds(summary.averageTimeMs)}</strong>
          <span>平均用時</span>
        </div>
      </div>

      <section className={styles.mistakes}>
        <h3>錯題列表</h3>
        {summary.mistakes.length === 0 ? (
          <p>沒有錯題，節奏很好。</p>
        ) : (
          <ul>
            {summary.mistakes.map((attempt) => (
              <li key={attempt.id}>
                <span>{attempt.question.prompt}</span>
                <span>
                  你的答案：{attempt.userAnswer || "未輸入"} / 正確答案：{attempt.correctAnswer}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Button onClick={onRestart}>再練一輪</Button>
    </Card>
  );
}
