import { useMemo, useState } from "react";
import { advanceSession, restartPracticeSession, submitAnswer } from "../session";
import type { PracticeSession } from "../types";
import type { Attempt } from "../../results/types";
import type { PracticePreferences } from "../../settings/types";

export function usePracticeSession(preferences: PracticePreferences) {
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [latestAttempt, setLatestAttempt] = useState<Attempt | undefined>();

  const summaryAttempts = useMemo(() => {
    if (!session) {
      return [];
    }

    return latestAttempt ? [...session.attempts, latestAttempt] : session.attempts;
  }, [latestAttempt, session]);

  function submit(userAnswer: string): void {
    if (!session || latestAttempt || session.status === "finished") {
      return;
    }

    const result = submitAnswer(session, userAnswer);
    setLatestAttempt(result.attempt);
  }

  function next(): void {
    if (!session || !latestAttempt) {
      return;
    }

    setSession((currentSession) => {
      if (!currentSession) {
        return currentSession;
      }

      return advanceSession(currentSession, latestAttempt);
    });
    setLatestAttempt(undefined);
  }

  function restart(nextPreferences = preferences): void {
    setSession(restartPracticeSession(nextPreferences));
    setLatestAttempt(undefined);
  }

  function start(nextPreferences = preferences): void {
    restart(nextPreferences);
  }

  return {
    session,
    latestAttempt,
    summaryAttempts,
    submit,
    next,
    restart,
    start,
  };
}
