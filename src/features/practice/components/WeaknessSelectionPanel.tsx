import { useEffect, useMemo, useState } from "react";
import type { SkillMetric } from "../../results/weakness";
import { Button } from "../../../shared/components/Button";
import { Card } from "../../../shared/components/Card";
import { formatMilliseconds, formatPercent } from "../../../shared/utils/format";
import styles from "./WeaknessSelectionPanel.module.css";

interface WeaknessSelectionPanelProps {
  weakTags: SkillMetric[];
  weakTypes: SkillMetric[];
  isReady: boolean;
  message?: string;
  preselectedTags?: string[];
  onStart: (tags: string[]) => void;
  onBack: () => void;
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

function WeaknessMetricRow({
  metric,
  checked,
  onToggle,
}: {
  metric: SkillMetric;
  checked: boolean;
  onToggle: (key: string) => void;
}) {
  return (
    <label className={checked ? styles.metricRowActive : styles.metricRow}>
      <input
        checked={checked}
        className={styles.checkbox}
        onChange={() => onToggle(metric.key)}
        type="checkbox"
      />
      <div className={styles.metricBody}>
        <div className={styles.metricHeader}>
          <strong>{metric.label}</strong>
          <span className={styles.metricStatus}>{getStatusLabel(metric.status)}</span>
        </div>
        <p className={styles.metricStats}>
          正確率 {formatPercent(metric.accuracy)} · 平均 {formatMilliseconds(metric.averageTimeMs)} ·{" "}
          {metric.questionCount} 題
        </p>
        {metric.diagnosis ? <p className={styles.metricDiagnosis}>{metric.diagnosis}</p> : null}
      </div>
    </label>
  );
}

export function WeaknessSelectionPanel({
  weakTags,
  weakTypes,
  isReady,
  message,
  preselectedTags,
  onStart,
  onBack,
}: WeaknessSelectionPanelProps) {
  const allTagKeys = useMemo(() => weakTags.map((metric) => metric.key), [weakTags]);
  const [selectedTags, setSelectedTags] = useState<string[]>(() => preselectedTags ?? []);

  useEffect(() => {
    if (preselectedTags && preselectedTags.length > 0) {
      setSelectedTags(preselectedTags.filter((tag) => allTagKeys.includes(tag)));
    }
  }, [allTagKeys, preselectedTags]);

  const allSelected = allTagKeys.length > 0 && selectedTags.length === allTagKeys.length;
  const canStart = selectedTags.length > 0;

  function toggleTag(tag: string): void {
    setSelectedTags((current) => {
      if (current.includes(tag)) {
        return current.filter((item) => item !== tag);
      }

      return [...current, tag];
    });
  }

  function toggleSelectAll(): void {
    if (allSelected) {
      setSelectedTags([]);
      return;
    }

    setSelectedTags(allTagKeys);
  }

  return (
    <Card className={styles.panel}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>弱項分析</p>
          <h2>鎖定弱項，開始專攻</h2>
          <p className={styles.lead}>勾選 2–3 項或任意組合，也可一次選全部弱項。</p>
        </div>
        <Button onClick={onBack} variant="ghost">
          返回首頁
        </Button>
      </div>

      {!isReady ? (
        <div className={styles.emptyState}>
          <p>{message ?? "目前還沒有足夠資料分析弱項。"}</p>
          <Button onClick={onBack} variant="secondary">
            回首頁練習
          </Button>
        </div>
      ) : (
        <>
          {weakTypes.length > 0 ? (
            <section className={styles.typeSection}>
              <h3>大題型概況</h3>
              <ul className={styles.typeList}>
                {weakTypes.map((metric) => (
                  <li key={metric.key}>
                    <strong>{metric.label}</strong>
                    <span>
                      {getStatusLabel(metric.status)} · 正確率 {formatPercent(metric.accuracy)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className={styles.selectionSection}>
            <label className={allSelected ? styles.selectAllActive : styles.selectAll}>
              <input
                checked={allSelected}
                className={styles.checkbox}
                onChange={toggleSelectAll}
                type="checkbox"
              />
              <div>
                <strong>全部弱項</strong>
                <span>一次選取所有細項能力（共 {allTagKeys.length} 項）</span>
              </div>
            </label>

            <div className={styles.metricList}>
              {weakTags.map((metric) => (
                <WeaknessMetricRow
                  checked={selectedTags.includes(metric.key)}
                  key={metric.key}
                  metric={metric}
                  onToggle={toggleTag}
                />
              ))}
            </div>
          </section>

          <div className={styles.footer}>
            {!canStart ? (
              <p className={styles.footerHint}>請至少選擇 1 項弱項再開始專攻。</p>
            ) : (
              <p className={styles.footerHint}>已選 {selectedTags.length} 項</p>
            )}
            <Button disabled={!canStart} onClick={() => onStart(selectedTags)}>
              開始專攻（已選 {selectedTags.length} 項）
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

export function buildWeaknessPrefill(
  allTagKeys: readonly string[],
  tags?: string[],
): string[] | undefined {
  if (!tags || tags.length === 0) {
    return undefined;
  }

  const filtered = tags.filter((tag) => allTagKeys.includes(tag));

  return filtered.length > 0 ? filtered : undefined;
}
