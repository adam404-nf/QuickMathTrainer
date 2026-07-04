import type { Question } from "../../questions/types";
import { getSkillTagLabel } from "../../questions/tags";
import { Card } from "../../../shared/components/Card";
import styles from "./PracticeComponents.module.css";

interface QuestionCardProps {
  question: Question;
  currentIndex: number;
  totalQuestions: number;
  focusTags?: string[];
}

export function QuestionCard({ question, currentIndex, totalQuestions, focusTags }: QuestionCardProps) {
  return (
    <Card className={styles.questionCard}>
      <div className={styles.questionMeta}>
        <span>
          第 {currentIndex + 1} / {totalQuestions} 題
        </span>
        <span>{question.difficulty}</span>
      </div>
      {focusTags && focusTags.length > 0 ? (
        <p className={styles.focusBanner}>
          正在專攻：{focusTags.map((tag) => getSkillTagLabel(tag)).join("、")}
        </p>
      ) : null}
      <p className={styles.prompt}>{question.prompt}</p>
      <p className={styles.strategy}>{question.strategy}</p>
    </Card>
  );
}
