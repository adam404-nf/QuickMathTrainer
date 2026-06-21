import { useEffect, useState } from "react";
import { AnswerForm } from "../../features/practice/components/AnswerForm";
import { FeedbackPanel } from "../../features/practice/components/FeedbackPanel";
import { QuestionCard } from "../../features/practice/components/QuestionCard";
import { SessionSummaryPanel } from "../../features/practice/components/SessionSummaryPanel";
import { usePracticeSession } from "../../features/practice/hooks/usePracticeSession";
import { createHistoryEntry, prependHistoryEntry } from "../../features/results/history";
import type { PracticeHistoryEntry } from "../../features/results/types";
import { defaultPracticePreferences } from "../../features/settings/preferences";
import type { PracticePreferences } from "../../features/settings/types";
import { Card } from "../../shared/components/Card";
import { createLocalStorageAdapter } from "../../shared/storage/localStorageAdapter";
import { formatMilliseconds, formatPercent } from "../../shared/utils/format";
import styles from "./PracticePage.module.css";

const preferencesStorage = createLocalStorageAdapter<PracticePreferences>("quickmathowo.preferences.v1");
const historyStorage = createLocalStorageAdapter<PracticeHistoryEntry[]>("quickmathowo.history.v1");

export function PracticePage() {
  const [preferences, setPreferences] = useState<PracticePreferences>(() => {
    return preferencesStorage.load() ?? defaultPracticePreferences;
  });
  const [history, setHistory] = useState<PracticeHistoryEntry[]>(() => historyStorage.load() ?? []);
  const [savedSessionIds, setSavedSessionIds] = useState<Set<string>>(() => new Set());
  const [answer, setAnswer] = useState("");
  const practice = usePracticeSession(preferences);

  useEffect(() => {
    if (practice.session.status !== "finished" || savedSessionIds.has(practice.session.id)) {
      return;
    }

    const entry = createHistoryEntry({
      id: practice.session.id,
      mode: practice.session.preferences.mode,
      difficulty: practice.session.preferences.difficulty,
      startedAt: practice.session.startedAt,
      endedAt: new Date().toISOString(),
      attempts: practice.session.attempts,
    });

    setHistory((currentHistory) => {
      const nextHistory = prependHistoryEntry(currentHistory, entry);
      historyStorage.save(nextHistory);
      return nextHistory;
    });
    setSavedSessionIds((currentIds) => new Set(currentIds).add(practice.session.id));
  }, [practice.session, savedSessionIds]);

  function updatePreferences(nextPreferences: PracticePreferences): void {
    setPreferences(nextPreferences);
    preferencesStorage.save(nextPreferences);
    setAnswer("");
    practice.restart(nextPreferences);
  }

  function handleSubmit(): void {
    practice.submit(answer);
  }

  function handleNext(): void {
    practice.next();
    setAnswer("");
  }

  const latestHistory = history[0];
  const isLastQuestion =
    practice.latestAttempt !== undefined &&
    practice.session.attempts.length + 1 >= practice.session.preferences.questionLimit;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>QuickMathOwo</p>
          <h1>Flashcard 式數學速度訓練</h1>
          <p>打開就開始練，專注提升計算速度、準確率與數字敏感度。</p>
        </div>
        <Card className={styles.settingsCard}>
          <label>
            模式
            <select
              onChange={(event) =>
                updatePreferences({
                  ...preferences,
                  mode: event.target.value as PracticePreferences["mode"],
                })
              }
              value={preferences.mode}
            >
              <option value="mixed">混合練習</option>
              <option value="arithmetic">整數四則</option>
              <option value="powers">冪次根號</option>
              <option value="fractions">分數小數</option>
            </select>
          </label>
          <label>
            難度
            <select
              onChange={(event) =>
                updatePreferences({
                  ...preferences,
                  difficulty: event.target.value as PracticePreferences["difficulty"],
                })
              }
              value={preferences.difficulty}
            >
              <option value="easy">easy</option>
              <option value="medium">medium</option>
              <option value="hard">hard</option>
            </select>
          </label>
          <label>
            題數
            <select
              onChange={(event) =>
                updatePreferences({
                  ...preferences,
                  questionLimit: Number(event.target.value),
                })
              }
              value={preferences.questionLimit}
            >
              <option value={5}>5 題</option>
              <option value={10}>10 題</option>
              <option value={20}>20 題</option>
            </select>
          </label>
        </Card>
      </section>

      <section className={styles.practiceLayout}>
        <div className={styles.practiceColumn}>
          {practice.session.status === "finished" ? (
            <SessionSummaryPanel attempts={practice.session.attempts} onRestart={() => practice.restart()} />
          ) : (
            <>
              <QuestionCard
                currentIndex={practice.session.currentIndex}
                question={practice.session.currentQuestion}
                totalQuestions={practice.session.preferences.questionLimit}
              />
              <AnswerForm
                answer={answer}
                disabled={practice.latestAttempt !== undefined}
                onAnswerChange={setAnswer}
                onSubmit={handleSubmit}
                question={practice.session.currentQuestion}
              />
              {practice.latestAttempt ? (
                <FeedbackPanel
                  attempt={practice.latestAttempt}
                  isLastQuestion={isLastQuestion}
                  onNext={handleNext}
                />
              ) : null}
            </>
          )}
        </div>

        <aside className={styles.sidePanel}>
          <Card>
            <h2>最近紀錄</h2>
            {latestHistory ? (
              <dl className={styles.historyStats}>
                <div>
                  <dt>正確率</dt>
                  <dd>{formatPercent(latestHistory.summary.accuracy)}</dd>
                </div>
                <div>
                  <dt>平均用時</dt>
                  <dd>{formatMilliseconds(latestHistory.summary.averageTimeMs)}</dd>
                </div>
                <div>
                  <dt>題數</dt>
                  <dd>{latestHistory.summary.totalQuestions}</dd>
                </div>
              </dl>
            ) : (
              <p>完成第一輪後會顯示最近練習紀錄。</p>
            )}
          </Card>
        </aside>
      </section>
    </main>
  );
}
