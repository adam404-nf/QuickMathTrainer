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
      <header className={styles.hero}>
        <p className={styles.eyebrow}>QuickMathOwo</p>
        <h1>你的數學訓練基地</h1>
        <p className={styles.lead}>選一個模式開始，專注提升速度、準確率與數字敏感度。</p>
        {latestAccuracy !== undefined ? (
          <p className={styles.latestStat}>最近一輪正確率 {Math.round(latestAccuracy * 100)}%</p>
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
              <option value="easy">easy</option>
              <option value="medium">medium</option>
              <option value="hard">hard</option>
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
          <div className={styles.modeIcon} aria-hidden="true">
            <span className={styles.modeIconGlyph}>+</span>
          </div>
          <h2>快速練習</h2>
          <p>專注單一題型，建立穩定節奏。</p>
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
          <div className={`${styles.modeIcon} ${styles.modeIconWeakness}`} aria-hidden="true">
            <span className={styles.modeIconGlyph}>◎</span>
          </div>
          <h2>弱項分析</h2>
          <p>查看全部弱項，多選 2–3 項或全部弱項開始專攻。</p>
          <Button className={styles.modeAction} onClick={onOpenWeakness} variant="secondary">
            查看弱項
          </Button>
        </Card>

        <Card className={`${styles.modeCard} ${styles.modeCardFeatured}`}>
          <div className={`${styles.modeIcon} ${styles.modeIconQuiz}`} aria-hidden="true">
            <span className={styles.modeIconGlyph}>∑</span>
          </div>
          <h2>混合測驗</h2>
          <p>混合所有題型，模擬完整測驗節奏。</p>
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
