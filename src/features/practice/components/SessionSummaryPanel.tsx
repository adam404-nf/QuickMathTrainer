import { createSessionSummary } from "../../results/summary";
import type { Attempt } from "../../results/types";
import type { SkillMetric } from "../../results/weakness";
import type { Difficulty } from "../../questions/types";
import { Button } from "../../../shared/components/Button";
import { Card } from "../../../shared/components/Card";
import { formatMilliseconds, formatPercent } from "../../../shared/utils/format";
import styles from "./PracticeComponents.module.css";

interface SessionSummaryPanelProps {
  attempts: Attempt[];
  difficulty: Difficulty;
  onRestart: () => void;
  onFocusWeakness?: (tags: string[]) => void;
  onFocusAllWeaknesses?: () => void;
}

function getStatusLabel(status: SkillMetric["status"]): string {
  if (status === "weak") {
    return "偏弱";
  }

  if (status === "insufficient_data") {
    return "資料不足";
  }

  return "穩定";
}

function WeaknessMetricItem({
  metric,
  onFocusWeakness,
}: {
  metric: SkillMetric;
  onFocusWeakness?: (tags: string[]) => void;
}) {
  return (
    <li className={styles.weaknessItem}>
      <div className={styles.weaknessHeader}>
        <strong>{metric.label}</strong>
        <span className={styles.weaknessStatus}>{getStatusLabel(metric.status)}</span>
      </div>
      <p className={styles.weaknessStats}>
        正確率 {formatPercent(metric.accuracy)} · 平均 {formatMilliseconds(metric.averageTimeMs)} ·{" "}
        {metric.questionCount} 題
      </p>
      {metric.diagnosis ? <p className={styles.weaknessDiagnosis}>{metric.diagnosis}</p> : null}
      {onFocusWeakness && metric.scope === "tag" ? (
        <Button className={styles.focusButton} onClick={() => onFocusWeakness([metric.key])} variant="secondary">
          專攻此項
        </Button>
      ) : null}
    </li>
  );
}

export function SessionSummaryPanel({
  attempts,
  difficulty,
  onRestart,
  onFocusWeakness,
  onFocusAllWeaknesses,
}: SessionSummaryPanelProps) {
  const summary = createSessionSummary(attempts, difficulty);
  const { weakness } = summary;
  const hasWeakItems = weakness.weakTypes.length > 0 || weakness.weakTags.length > 0;

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

      <section className={styles.weaknessSection}>
        <h3>偏弱項目</h3>
        {!hasWeakItems ? (
          <p>
            {weakness.hasInsufficientSample
              ? "這輪樣本較少，先多練幾輪再看趨勢。"
              : "這輪沒有明顯弱項，節奏很好。"}
          </p>
        ) : (
          <>
            {weakness.weakTypes.length > 0 ? (
              <div className={styles.weaknessGroup}>
                <h4>大題型</h4>
                <ul>
                  {weakness.weakTypes.map((metric) => (
                    <WeaknessMetricItem key={`type-${metric.key}`} metric={metric} />
                  ))}
                </ul>
              </div>
            ) : null}
            {weakness.weakTags.length > 0 ? (
              <div className={styles.weaknessGroup}>
                <h4>細項能力</h4>
                <ul>
                  {weakness.weakTags.slice(0, 3).map((metric) => (
                    <WeaknessMetricItem
                      key={`tag-${metric.key}`}
                      metric={metric}
                      onFocusWeakness={onFocusWeakness}
                    />
                  ))}
                </ul>
              </div>
            ) : null}
            {onFocusAllWeaknesses && weakness.weakTags.length > 0 ? (
              <Button onClick={onFocusAllWeaknesses} variant="secondary">
                專攻全部弱項
              </Button>
            ) : null}
          </>
        )}
      </section>

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
