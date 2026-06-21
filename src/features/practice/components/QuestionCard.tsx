import type { Question } from "../../questions/types";
import { Card } from "../../../shared/components/Card";
import styles from "./PracticeComponents.module.css";

interface QuestionCardProps {
  question: Question;
  currentIndex: number;
  totalQuestions: number;
}

export function QuestionCard({ question, currentIndex, totalQuestions }: QuestionCardProps) {
  return (
    <Card className={styles.questionCard}>
      <div className={styles.questionMeta}>
        <span>
          第 {currentIndex + 1} / {totalQuestions} 題
        </span>
        <span>{question.difficulty}</span>
      </div>
      <p className={styles.prompt}>{question.prompt}</p>
      <p className={styles.strategy}>{question.strategy}</p>
    </Card>
  );
}
