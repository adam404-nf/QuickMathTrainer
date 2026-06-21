import { useMemo, useState } from "react";
import { advanceSession, createPracticeSession, restartPracticeSession, submitAnswer } from "../session";
import type { PracticeSession } from "../types";
import type { Attempt } from "../../results/types";
import type { PracticePreferences } from "../../settings/types";

export function usePracticeSession(preferences: PracticePreferences) {
  const [session, setSession] = useState<PracticeSession>(() => createPracticeSession(preferences));
  const [latestAttempt, setLatestAttempt] = useState<Attempt | undefined>();

  const summaryAttempts = useMemo(() => {
    return latestAttempt ? [...session.attempts, latestAttempt] : session.attempts;
  }, [latestAttempt, session.attempts]);

  function submit(userAnswer: string): void {
    if (latestAttempt || session.status === "finished") {
      return;
    }

    const result = submitAnswer(session, userAnswer);
    setLatestAttempt(result.attempt);
  }

  function next(): void {
    if (!latestAttempt) {
      return;
    }

    setSession((currentSession) => advanceSession(currentSession, latestAttempt));
    setLatestAttempt(undefined);
  }

  function restart(nextPreferences = preferences): void {
    setSession(restartPracticeSession(nextPreferences));
    setLatestAttempt(undefined);
  }

  return {
    session,
    latestAttempt,
    summaryAttempts,
    submit,
    next,
    restart,
  };
}
