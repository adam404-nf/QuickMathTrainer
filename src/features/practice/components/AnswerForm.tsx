import type { FormEvent } from "react";
import type { Question } from "../../questions/types";
import { getAnswerFormatHint } from "../../questions/utils";
import { Button } from "../../../shared/components/Button";
import { Card } from "../../../shared/components/Card";
import styles from "./PracticeComponents.module.css";

interface AnswerFormProps {
  question: Question;
  answer: string;
  disabled: boolean;
  canGoPrevious: boolean;
  canRevealAnswer: boolean;
  canGoNext: boolean;
  nextLabel: string;
  onAnswerChange: (answer: string) => void;
  onSubmit: () => void;
  onPrevious: () => void;
  onRevealAnswer: () => void;
  onNext: () => void;
}

export function AnswerForm({
  question,
  answer,
  disabled,
  canGoPrevious,
  canRevealAnswer,
  canGoNext,
  nextLabel,
  onAnswerChange,
  onSubmit,
  onPrevious,
  onRevealAnswer,
  onNext,
}: AnswerFormProps) {
  const canSubmit = Boolean(answer.trim());

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (canSubmit) {
      onSubmit();
    }
  }

  const isMultipleChoice = question.kind === "multiple-choice" && question.options;
  const answerFormatHint = !isMultipleChoice ? getAnswerFormatHint(question.answer) : undefined;

  return (
    <Card className={styles.answerCard}>
      <form className={styles.answerForm} onSubmit={handleSubmit}>
        {isMultipleChoice ? (
          <>
            <p className={styles.answerLabel} id="answer-options-label">
              選擇答案
            </p>
            <div
              aria-labelledby="answer-options-label"
              className={styles.options}
              role="group"
            >
              {question.options!.map((option) => {
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
            <Button disabled={disabled || !canSubmit} type="submit">
              送出
            </Button>
            <div className={styles.answerNav}>
              <Button
                className={styles.answerNavButton}
                disabled={!canGoPrevious}
                onClick={onPrevious}
                type="button"
                variant="secondary"
              >
                上一題
              </Button>
              <Button
                className={styles.answerNavButton}
                disabled={!canRevealAnswer}
                onClick={onRevealAnswer}
                type="button"
                variant="secondary"
              >
                看答案
              </Button>
              <Button
                className={styles.answerNavButton}
                disabled={!canGoNext}
                onClick={onNext}
                type="button"
              >
                {nextLabel}
              </Button>
            </div>
          </>
        ) : (
          <>
            <label className={styles.answerLabel} htmlFor="answer">
              你的答案
            </label>
            {answerFormatHint ? (
              <p className={styles.answerHint} id="answer-format-hint">
                {answerFormatHint}
              </p>
            ) : null}
            <div className={styles.answerRow}>
              <input
                aria-describedby={answerFormatHint ? "answer-format-hint" : undefined}
                autoComplete="off"
                autoFocus
                className={styles.answerInput}
                disabled={disabled}
                id="answer"
                inputMode="text"
                onChange={(event) => onAnswerChange(event.target.value)}
                placeholder="輸入答案後按 Enter"
                type="text"
                value={answer}
              />
              <Button disabled={disabled || !canSubmit} type="submit">
                送出
              </Button>
            </div>
            <div className={styles.answerNav}>
              <Button
                className={styles.answerNavButton}
                disabled={!canGoPrevious}
                onClick={onPrevious}
                type="button"
                variant="secondary"
              >
                上一題
              </Button>
              <Button
                className={styles.answerNavButton}
                disabled={!canRevealAnswer}
                onClick={onRevealAnswer}
                type="button"
                variant="secondary"
              >
                看答案
              </Button>
              <Button
                className={styles.answerNavButton}
                disabled={!canGoNext}
                onClick={onNext}
                type="button"
              >
                {nextLabel}
              </Button>
            </div>
          </>
        )}
      </form>
    </Card>
  );
}
