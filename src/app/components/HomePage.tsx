import type { QuestionType } from "../../features/questions/types";
import { QUESTION_TYPE_LABELS } from "../../features/questions/tags";
import type { PracticePreferences, SessionLengthPreset } from "../../features/settings/types";
import {
  SESSION_LENGTH_LABELS,
  getQuestionLimitForPreset,
} from "../../features/settings/sessionLength";
import { Button } from "../../shared/components/Button";
import { Card } from "../../shared/components/Card";
import styles from "./HomePage.module.css";

interface HomePageProps {
  preferences: PracticePreferences;
  quickPracticeType: QuestionType;
  latestAccuracy?: number;
  onQuickPracticeTypeChange: (type: QuestionType) => void;
  onDifficultyChange: (difficulty: PracticePreferences["difficulty"]) => void;
  onSessionLengthChange: (sessionLength: SessionLengthPreset) => void;
  onStartQuickPractice: () => void;
  onOpenWeakness: () => void;
  onStartQuiz: () => void;
}

const QUESTION_TYPES = Object.keys(QUESTION_TYPE_LABELS) as QuestionType[];

const DIFFICULTY_LABELS: Record<PracticePreferences["difficulty"], string> = {
  easy: "基礎",
  medium: "標準",
  hard: "挑戰",
  extreme: "極限",
};

export function HomePage({
  preferences,
  quickPracticeType,
  latestAccuracy,
  onQuickPracticeTypeChange,
  onDifficultyChange,
  onSessionLengthChange,
  onStartQuickPractice,
  onOpenWeakness,
  onStartQuiz,
}: HomePageProps) {
  return (
    <div className={styles.home}>
      <div className={styles.numberMascots} aria-hidden="true">
        <span className={`${styles.numberMascot} ${styles.numberMascotOne}`}>7</span>
        <span className={`${styles.numberMascot} ${styles.numberMascotTwo}`}>π</span>
        <span className={`${styles.numberMascot} ${styles.numberMascotThree}`}>12</span>
        <span className={`${styles.numberMascot} ${styles.numberMascotFour}`}>√</span>
      </div>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>QuickMathOwo · Precision Lab</p>
        <h1>把每一次心算，校準到更穩更準</h1>
        <p className={styles.lead}>
          面向 IAL、DSE、高考語境的 Flashcard 速算訓練。像在實驗台上校準反應速度：答題、回饋、診斷、再專攻。
        </p>
        {latestAccuracy !== undefined ? (
          <p className={styles.latestStat}>
            <span className={styles.latestStatLabel}>最近一輪</span>
            <span className={styles.latestStatValue}>{Math.round(latestAccuracy * 100)}%</span>
          </p>
        ) : null}
      </header>

      <Card className={styles.settingsCard}>
        <h2 className={styles.settingsTitle}>練習設定</h2>
        <div className={styles.settingsGrid}>
          <label>
            難度
            <select
              onChange={(event) =>
                onDifficultyChange(event.target.value as PracticePreferences["difficulty"])
              }
              value={preferences.difficulty}
            >
              {(Object.keys(DIFFICULTY_LABELS) as PracticePreferences["difficulty"][]).map(
                (level) => (
                  <option key={level} value={level}>
                    {DIFFICULTY_LABELS[level]}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            題量
            <select
              onChange={(event) => onSessionLengthChange(event.target.value as SessionLengthPreset)}
              value={preferences.sessionLength}
            >
              {(Object.keys(SESSION_LENGTH_LABELS) as SessionLengthPreset[]).map((preset) => (
                <option key={preset} value={preset}>
                  {SESSION_LENGTH_LABELS[preset]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <section className={styles.modeGrid} aria-label="訓練模式">
        <Card className={styles.modeCard}>
          <div className={styles.modeCardStripe} aria-hidden="true" />
          <div className={`${styles.modeIcon} ${styles.modeIconQuick}`} aria-hidden="true">
            <span className={styles.modeIconGlyph}>+</span>
          </div>
          <h2>快速練習</h2>
          <p>專注單一題型，建立穩定節奏與計算手感。</p>
          <div className={styles.typeChips} role="group" aria-label="快速練習題型">
            {QUESTION_TYPES.map((type) => (
              <button
                aria-pressed={quickPracticeType === type}
                className={quickPracticeType === type ? styles.typeChipActive : styles.typeChip}
                key={type}
                onClick={() => onQuickPracticeTypeChange(type)}
                type="button"
              >
                {QUESTION_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
          <Button className={styles.modeAction} onClick={onStartQuickPractice}>
            開始 {QUESTION_TYPE_LABELS[quickPracticeType]}
          </Button>
        </Card>

        <Card className={styles.modeCard}>
          <div className={`${styles.modeCardStripe} ${styles.modeCardStripeAmber}`} aria-hidden="true" />
          <div className={`${styles.modeIcon} ${styles.modeIconWeakness}`} aria-hidden="true">
            <span className={styles.modeIconGlyph}>◎</span>
          </div>
          <h2>弱項專攻</h2>
          <p>依歷史紀錄鎖定偏弱能力，像校準儀器一樣逐項修正。</p>
          <Button className={styles.modeAction} onClick={onOpenWeakness} variant="secondary">
            查看弱項
          </Button>
        </Card>

        <Card className={`${styles.modeCard} ${styles.modeCardFeatured}`}>
          <div className={`${styles.modeCardStripe} ${styles.modeCardStripeSlate}`} aria-hidden="true" />
          <div className={`${styles.modeIcon} ${styles.modeIconQuiz}`} aria-hidden="true">
            <span className={styles.modeIconGlyph}>∑</span>
          </div>
          <h2>混合測驗</h2>
          <p>混合所有題型，訓練考場需要的切換速度與穩定性。</p>
          <Button className={styles.modeAction} onClick={onStartQuiz}>
            開始混合測驗
          </Button>
        </Card>
      </section>
    </div>
  );
}

export function getQuickPracticePreferences(
  preferences: PracticePreferences,
  quickPracticeType: QuestionType,
): PracticePreferences {
  return {
    ...preferences,
    mode: quickPracticeType,
    targetTags: undefined,
    targetTypes: undefined,
    questionLimit: getQuestionLimitForPreset(preferences.sessionLength),
  };
}

export function getQuizPreferences(preferences: PracticePreferences): PracticePreferences {
  return {
    ...preferences,
    mode: "mixed",
    targetTags: undefined,
    targetTypes: undefined,
    selectedQuestionTypes: ["arithmetic", "fractions", "powers"],
    questionLimit: getQuestionLimitForPreset(preferences.sessionLength),
  };
}
