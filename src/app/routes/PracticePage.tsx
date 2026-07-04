import { useEffect, useState } from "react";
import { AnswerForm } from "../../features/practice/components/AnswerForm";
import { FeedbackPanel } from "../../features/practice/components/FeedbackPanel";
import { QuestionCard } from "../../features/practice/components/QuestionCard";
import { SessionSummaryPanel } from "../../features/practice/components/SessionSummaryPanel";
import { usePracticeSession } from "../../features/practice/hooks/usePracticeSession";
import { createHistoryEntry, prependHistoryEntry } from "../../features/results/history";
import type { PracticeHistoryEntry } from "../../features/results/types";
import { deriveWeaknessTargets } from "../../features/results/weaknessProfile";
import { getWeaknessTargetTags } from "../../features/results/weakness";
import { createWeaknessBreakdown } from "../../features/results/weakness";
import {
  defaultPracticePreferences,
  normalizePracticePreferences,
} from "../../features/settings/preferences";
import {
  SESSION_LENGTH_LABELS,
  getQuestionLimitForPreset,
  inferPresetFromQuestionLimit,
} from "../../features/settings/sessionLength";
import type { PracticePreferences, SessionLengthPreset } from "../../features/settings/types";
import { Card } from "../../shared/components/Card";
import { createLocalStorageAdapter } from "../../shared/storage/localStorageAdapter";
import { formatMilliseconds, formatPercent } from "../../shared/utils/format";
import styles from "./PracticePage.module.css";

const preferencesStorage = createLocalStorageAdapter<PracticePreferences>("quickmathowo.preferences.v1");
const historyStorage = createLocalStorageAdapter<PracticeHistoryEntry[]>("quickmathowo.history.v1");

function loadPreferences(): PracticePreferences {
  const stored = preferencesStorage.load();

  if (!stored) {
    return defaultPracticePreferences;
  }

  const sessionLength =
    stored.sessionLength ?? inferPresetFromQuestionLimit(stored.questionLimit ?? defaultPracticePreferences.questionLimit);

  return normalizePracticePreferences({
    ...stored,
    sessionLength,
  });
}

export function PracticePage() {
  const [preferences, setPreferences] = useState<PracticePreferences>(() => loadPreferences());
  const [history, setHistory] = useState<PracticeHistoryEntry[]>(() => historyStorage.load() ?? []);
  const [savedSessionIds, setSavedSessionIds] = useState<Set<string>>(() => new Set());
  const [modeNotice, setModeNotice] = useState<string | undefined>();
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

  function applyPreferences(nextPreferences: PracticePreferences): void {
    const normalized = normalizePracticePreferences(nextPreferences);
    setPreferences(normalized);
    preferencesStorage.save(normalized);
    setAnswer("");
    practice.restart(normalized);
  }

  function updatePreferences(nextPreferences: PracticePreferences): void {
    setModeNotice(undefined);
    applyPreferences(nextPreferences);
  }

  function startWeaknessFocusedMode(tags: string[]): void {
    const targets = deriveWeaknessTargets(history, preferences.difficulty);

    if (!targets.isReady && tags.length === 0) {
      setModeNotice(targets.message);
      return;
    }

    const targetTags = tags.length > 0 ? tags : targets.tags;

    applyPreferences({
      ...preferences,
      mode: "weakness-focused",
      targetTags,
      targetTypes: targets.types,
    });
  }

  function handleModeChange(mode: PracticePreferences["mode"]): void {
    if (mode === "weakness-focused") {
      const targets = deriveWeaknessTargets(history, preferences.difficulty);

      if (!targets.isReady) {
        setModeNotice(targets.message);
        updatePreferences({
          ...preferences,
          mode: "mixed",
          targetTags: undefined,
          targetTypes: undefined,
        });
        return;
      }

      updatePreferences({
        ...preferences,
        mode: "weakness-focused",
        targetTags: targets.tags,
        targetTypes: targets.types,
      });
      return;
    }

    updatePreferences({
      ...preferences,
      mode,
      targetTags: undefined,
      targetTypes: undefined,
    });
  }

  function handleSessionLengthChange(sessionLength: SessionLengthPreset): void {
    updatePreferences({
      ...preferences,
      sessionLength,
      questionLimit: getQuestionLimitForPreset(sessionLength),
    });
  }

  function handleSubmit(): void {
    practice.submit(answer);
  }

  function handleNext(): void {
    practice.next();
    setAnswer("");
  }

  function handleFocusAllWeaknesses(): void {
    const breakdown = createWeaknessBreakdown(practice.session.attempts, preferences.difficulty);
    startWeaknessFocusedMode(getWeaknessTargetTags(breakdown, 3));
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
              onChange={(event) => handleModeChange(event.target.value as PracticePreferences["mode"])}
              value={preferences.mode}
            >
              <option value="mixed">混合練習</option>
              <option value="arithmetic">整數四則</option>
              <option value="powers">冪次根號</option>
              <option value="fractions">分數小數</option>
              <option value="weakness-focused">弱項專攻</option>
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
            題量
            <select
              onChange={(event) => handleSessionLengthChange(event.target.value as SessionLengthPreset)}
              value={preferences.sessionLength}
            >
              {(Object.keys(SESSION_LENGTH_LABELS) as SessionLengthPreset[]).map((preset) => (
                <option key={preset} value={preset}>
                  {SESSION_LENGTH_LABELS[preset]}
                </option>
              ))}
            </select>
          </label>
          {modeNotice ? <p className={styles.modeNotice}>{modeNotice}</p> : null}
        </Card>
      </section>

      <section className={styles.practiceLayout}>
        <div className={styles.practiceColumn}>
          {practice.session.status === "finished" ? (
            <SessionSummaryPanel
              attempts={practice.session.attempts}
              difficulty={preferences.difficulty}
              onFocusAllWeaknesses={handleFocusAllWeaknesses}
              onFocusWeakness={(tags) => startWeaknessFocusedMode(tags)}
              onRestart={() => practice.restart()}
            />
          ) : (
            <>
              <QuestionCard
                currentIndex={practice.session.currentIndex}
                focusTags={
                  preferences.mode === "weakness-focused" ? preferences.targetTags : undefined
                }
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
