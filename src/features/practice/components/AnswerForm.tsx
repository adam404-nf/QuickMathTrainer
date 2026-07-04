import type { FormEvent } from "react";
import type { Question } from "../../questions/types";
import { Button } from "../../../shared/components/Button";
import { Card } from "../../../shared/components/Card";
import styles from "./PracticeComponents.module.css";

interface AnswerFormProps {
  question: Question;
  answer: string;
  disabled: boolean;
  onAnswerChange: (answer: string) => void;
  onSubmit: () => void;
}

export function AnswerForm({ question, answer, disabled, onAnswerChange, onSubmit }: AnswerFormProps) {
  const canSubmit = Boolean(answer.trim());

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (canSubmit) {
      onSubmit();
    }
  }

  return (
    <Card className={styles.answerCard}>
      <form className={styles.answerForm} onSubmit={handleSubmit}>
        {question.kind === "multiple-choice" && question.options ? (
          <div className={styles.options} role="group" aria-label="選擇答案">
            {question.options.map((option) => {
              const isSelected = answer === option;

              return (
                <button
                  aria-pressed={isSelected}
                  className={isSelected ? styles.optionActive : styles.option}
                  disabled={disabled}
                  key={option}
                  onClick={() => onAnswerChange(option)}
                  type="button"
                >
                  {option}
                </button>
              );
            })}
          </div>
        ) : null}

        <label className={styles.answerLabel} htmlFor="answer">
          你的答案
        </label>
        <div className={styles.answerRow}>
          <input
            autoComplete="off"
            autoFocus
            className={styles.answerInput}
            disabled={disabled}
            id="answer"
            inputMode="decimal"
            onChange={(event) => onAnswerChange(event.target.value)}
            placeholder="輸入答案後按 Enter"
            type="text"
            value={answer}
          />
          <Button disabled={disabled || !canSubmit} type="submit">
            送出
          </Button>
        </div>
      </form>
    </Card>
  );
}
