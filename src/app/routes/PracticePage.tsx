import { useEffect, useMemo, useRef, useState } from "react";
import type { AppScreen } from "../types";
import {
  getQuizPreferences,
  getQuickPracticePreferences,
  HomePage,
} from "../components/HomePage";
import { AnswerForm } from "../../features/practice/components/AnswerForm";
import { FeedbackPanel } from "../../features/practice/components/FeedbackPanel";
import { QuestionCard } from "../../features/practice/components/QuestionCard";
import { SessionSummaryPanel } from "../../features/practice/components/SessionSummaryPanel";
import {
  buildWeaknessPrefill,
  WeaknessSelectionPanel,
} from "../../features/practice/components/WeaknessSelectionPanel";
import { usePracticeSession } from "../../features/practice/hooks/usePracticeSession";
import { getPracticeViewState } from "../../features/practice/practiceView";
import { getQuestionTypesForTags } from "../../features/questions/templates";
import type { QuestionType } from "../../features/questions/types";
import { createHistoryEntry, prependHistoryEntry } from "../../features/results/history";
import type { PracticeHistoryEntry } from "../../features/results/types";
import { deriveWeaknessBreakdownFromHistory } from "../../features/results/weaknessProfile";
import {
  defaultPracticePreferences,
  normalizePracticePreferences,
} from "../../features/settings/preferences";
import {
  getQuestionLimitForPreset,
  inferPresetFromQuestionLimit,
} from "../../features/settings/sessionLength";
import type { PracticePreferences, SessionLengthPreset } from "../../features/settings/types";
import { Button } from "../../shared/components/Button";
import { Card } from "../../shared/components/Card";
import { createLocalStorageAdapter } from "../../shared/storage/localStorageAdapter";
import { formatMilliseconds, formatPercent } from "../../shared/utils/format";
import { confirmExitPractice } from "./practiceNavigation";
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

function getPracticeModeLabel(mode: PracticePreferences["mode"]): string {
  if (mode === "mixed") {
    return "混合測驗";
  }

  if (mode === "weakness-focused") {
    return "弱項專攻";
  }

  if (mode === "arithmetic") {
    return "整數四則";
  }

  if (mode === "fractions") {
    return "分數小數";
  }

  return "冪次根號";
}

export function PracticePage() {
  const [screen, setScreen] = useState<AppScreen>("home");
  const [preferences, setPreferences] = useState<PracticePreferences>(() => loadPreferences());
  const [history, setHistory] = useState<PracticeHistoryEntry[]>(() => historyStorage.load() ?? []);
  const [savedSessionIds, setSavedSessionIds] = useState<Set<string>>(() => new Set());
  const [quickPracticeType, setQuickPracticeType] = useState<QuestionType>("arithmetic");
  const [weaknessPrefillTags, setWeaknessPrefillTags] = useState<string[] | undefined>();
  const [answer, setAnswer] = useState("");
  const draftAnswersRef = useRef<Record<number, string>>({});
  const practice = usePracticeSession(preferences);

  const weaknessData = useMemo(
    () => deriveWeaknessBreakdownFromHistory(history, preferences.difficulty),
    [history, preferences.difficulty],
  );

  useEffect(() => {
    if (!practice.session) {
      return;
    }

    const viewState = getPracticeViewState(
      practice.session,
      practice.viewIndex,
      practice.latestAttempt,
    );

    if (viewState.attempt) {
      setAnswer(viewState.attempt.userAnswer);
      return;
    }

    if (!viewState.isReviewing) {
      setAnswer(draftAnswersRef.current[practice.viewIndex] ?? "");
    }
  }, [practice.viewIndex, practice.session, practice.latestAttempt]);

  useEffect(() => {
    if (!practice.session || practice.session.status !== "finished" || savedSessionIds.has(practice.session.id)) {
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
    setSavedSessionIds((currentIds) => new Set(currentIds).add(practice.session!.id));
  }, [practice.session, savedSessionIds]);

  function savePreferences(nextPreferences: PracticePreferences): PracticePreferences {
    const normalized = normalizePracticePreferences(nextPreferences);
    setPreferences(normalized);
    preferencesStorage.save(normalized);
    return normalized;
  }

  function updateHomePreferences(nextPreferences: PracticePreferences): void {
    savePreferences(nextPreferences);
  }

  function enterPractice(nextPreferences: PracticePreferences): void {
    const normalized = savePreferences(nextPreferences);
    draftAnswersRef.current = {};
    setAnswer("");
    practice.start(normalized);
    setScreen("practice");
  }

  function handleStartQuickPractice(): void {
    enterPractice(getQuickPracticePreferences(preferences, quickPracticeType));
  }

  function handleStartQuiz(): void {
    enterPractice(getQuizPreferences(preferences));
  }

  function handleOpenWeakness(prefillTags?: string[]): void {
    setWeaknessPrefillTags(prefillTags);
    setScreen("weakness");
  }

  function handleStartWeaknessPractice(selectedTags: string[]): void {
    const targetTypes = getQuestionTypesForTags(selectedTags);

    enterPractice({
      ...preferences,
      mode: "weakness-focused",
      targetTags: selectedTags,
      targetTypes: targetTypes.length > 0 ? targetTypes : undefined,
      questionLimit: getQuestionLimitForPreset(preferences.sessionLength),
    });
  }

  function handleDifficultyChange(difficulty: PracticePreferences["difficulty"]): void {
    updateHomePreferences({ ...preferences, difficulty });
  }

  function handleSessionLengthChange(sessionLength: SessionLengthPreset): void {
    updateHomePreferences({
      ...preferences,
      sessionLength,
      questionLimit: getQuestionLimitForPreset(sessionLength),
    });
  }

  function handleAnswerChange(nextAnswer: string): void {
    if (session && practice.viewIndex === session.currentIndex && practice.latestAttempt === undefined) {
      draftAnswersRef.current[practice.viewIndex] = nextAnswer;
    }

    setAnswer(nextAnswer);
  }

  function handleSubmit(): void {
    practice.submit(answer);
  }

  function handleRevealAnswer(): void {
    practice.reveal();
    setAnswer("");
  }

  function handlePrevious(): void {
    practice.previous();
  }

  function handleNext(): void {
    const isAdvancingCurrent =
      session &&
      practice.viewIndex === session.currentIndex &&
      practice.latestAttempt !== undefined;

    practice.next();

    if (isAdvancingCurrent) {
      delete draftAnswersRef.current[practice.viewIndex];
      setAnswer("");
    }
  }

  function handleRestartPractice(): void {
    if (!practice.session) {
      return;
    }

    setAnswer("");
    practice.restart(practice.session.preferences);
  }

  function handleGoHome(): void {
    if (!confirmExitPractice(session, practice.latestAttempt)) {
      return;
    }

    setAnswer("");
    draftAnswersRef.current = {};
    practice.abandon();
    setScreen("home");
  }

  function handleReviewWeaknesses(prefillTags?: string[]): void {
    handleOpenWeakness(prefillTags);
  }

  const latestHistory = history[0];
  const session = practice.session;
  const practiceView = session
    ? getPracticeViewState(session, practice.viewIndex, practice.latestAttempt)
    : undefined;
  const isLastQuestion =
    session &&
    practice.viewIndex === session.currentIndex &&
    practice.latestAttempt !== undefined &&
    session.attempts.length + 1 >= session.preferences.questionLimit;
  const canGoPrevious = practice.viewIndex > 0;
  const canRevealAnswer = practiceView
    ? !practiceView.isReviewing && practiceView.attempt === undefined
    : false;
  const canGoNext = practiceView
    ? practiceView.isReviewing || practiceView.attempt !== undefined
    : false;
  const nextLabel = isLastQuestion ? "查看統計" : "下一題";

  const allWeakTagKeys = weaknessData.breakdown.weakTags.map((metric) => metric.key);

  return (
    <main className={styles.page} data-screen={screen}>
      {screen === "home" ? (
        <HomePage
          latestAccuracy={latestHistory?.summary.accuracy}
          onDifficultyChange={handleDifficultyChange}
          onOpenWeakness={() => handleOpenWeakness()}
          onQuickPracticeTypeChange={setQuickPracticeType}
          onSessionLengthChange={handleSessionLengthChange}
          onStartQuickPractice={handleStartQuickPractice}
          onStartQuiz={handleStartQuiz}
          preferences={preferences}
          quickPracticeType={quickPracticeType}
        />
      ) : null}

      {screen === "weakness" ? (
        <WeaknessSelectionPanel
          isReady={weaknessData.isReady}
          message={weaknessData.message}
          onBack={handleGoHome}
          onStart={handleStartWeaknessPractice}
          preselectedTags={buildWeaknessPrefill(allWeakTagKeys, weaknessPrefillTags)}
          weakTags={weaknessData.breakdown.weakTags}
          weakTypes={weaknessData.breakdown.weakTypes}
        />
      ) : null}

      {screen === "practice" && session ? (
        <section className={styles.practiceShell}>
          <header className={styles.practiceHeader}>
            <div>
              <p className={styles.eyebrow}>{getPracticeModeLabel(session.preferences.mode)}</p>
              <h1>速算進行中</h1>
            </div>
            <Button className={styles.headerExitButton} onClick={handleGoHome} variant="secondary">
              返回首頁
            </Button>
          </header>

          <div className={styles.practiceLayout}>
            <div className={styles.practiceColumn}>
              {session.status === "finished" ? (
                <SessionSummaryPanel
                  attempts={session.attempts}
                  difficulty={session.preferences.difficulty}
                  onGoHome={handleGoHome}
                  onRestart={handleRestartPractice}
                  onReviewWeaknesses={handleReviewWeaknesses}
                />
              ) : (
                <>
                  <QuestionCard
                    key={`${session.currentIndex}-${practice.viewIndex}`}
                    currentIndex={practice.viewIndex}
                    focusTags={
                      session.preferences.mode === "weakness-focused"
                        ? session.preferences.targetTags
                        : undefined
                    }
                    modeLabel={getPracticeModeLabel(session.preferences.mode)}
                    question={practiceView!.question}
                    totalQuestions={session.preferences.questionLimit}
                  />
                  <AnswerForm
                    answer={answer}
                    canGoNext={canGoNext}
                    canGoPrevious={canGoPrevious}
                    canRevealAnswer={canRevealAnswer}
                    disabled={practiceView!.attempt !== undefined}
                    nextLabel={nextLabel}
                    onAnswerChange={handleAnswerChange}
                    onNext={handleNext}
                    onPrevious={handlePrevious}
                    onRevealAnswer={handleRevealAnswer}
                    onSubmit={handleSubmit}
                    question={practiceView!.question}
                  />
                  {practiceView!.attempt ? (
                    <FeedbackPanel attempt={practiceView!.attempt} />
                  ) : null}
                </>
              )}
            </div>

            <aside className={styles.sidePanel}>
              <Card>
                <h2>本輪進度</h2>
                {session.status === "finished" ? (
                  <dl className={styles.historyStats}>
                    <div>
                      <dt>狀態</dt>
                      <dd>已完成</dd>
                    </div>
                    <div>
                      <dt>題數</dt>
                      <dd>{session.attempts.length}</dd>
                    </div>
                  </dl>
                ) : (
                  <>
                    <dl className={styles.historyStats}>
                      <div>
                        <dt>目前題號</dt>
                        <dd>
                          {practice.viewIndex + 1} / {session.preferences.questionLimit}
                        </dd>
                      </div>
                      <div>
                        <dt>已答</dt>
                        <dd>{session.attempts.length}</dd>
                      </div>
                    </dl>
                    <div className={styles.sideExit}>
                      <p className={styles.sideHint}>測驗進行中也可返回首頁。</p>
                      <Button className={styles.sideExitButton} onClick={handleGoHome} variant="secondary">
                        返回首頁
                      </Button>
                    </div>
                  </>
                )}
              </Card>

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
                  <p className={styles.sideHint}>完成第一輪後會顯示最近練習紀錄。</p>
                )}
              </Card>
            </aside>
          </div>
        </section>
      ) : null}
    </main>
  );
}
