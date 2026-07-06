import { useMemo, useState } from "react";
import { advanceSession, restartPracticeSession, revealAnswer, submitAnswer } from "../session";
import type { PracticeSession } from "../types";
import type { Attempt } from "../../results/types";
import type { PracticePreferences } from "../../settings/types";

export function usePracticeSession(preferences: PracticePreferences) {
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [latestAttempt, setLatestAttempt] = useState<Attempt | undefined>();
  const [viewIndex, setViewIndex] = useState(0);

  const summaryAttempts = useMemo(() => {
    if (!session) {
      return [];
    }

    return latestAttempt ? [...session.attempts, latestAttempt] : session.attempts;
  }, [latestAttempt, session]);

  function submit(userAnswer: string): void {
    if (!session || latestAttempt || session.status === "finished" || viewIndex !== session.currentIndex) {
      return;
    }

    const result = submitAnswer(session, userAnswer);
    setLatestAttempt(result.attempt);
  }

  function reveal(): void {
    if (!session || latestAttempt || session.status === "finished" || viewIndex !== session.currentIndex) {
      return;
    }

    const result = revealAnswer(session);
    setLatestAttempt(result.attempt);
  }

  function previous(): void {
    if (!session || viewIndex <= 0) {
      return;
    }

    setViewIndex(viewIndex - 1);
  }

  function next(): void {
    if (!session) {
      return;
    }

    if (viewIndex < session.currentIndex) {
      setViewIndex(viewIndex + 1);
      return;
    }

    if (!latestAttempt) {
      return;
    }

    const nextSession = advanceSession(session, latestAttempt);
    setSession(nextSession);
    setLatestAttempt(undefined);
    setViewIndex(nextSession.status === "finished" ? session.currentIndex : nextSession.currentIndex);
  }

  function restart(nextPreferences = preferences): void {
    setSession(restartPracticeSession(nextPreferences));
    setLatestAttempt(undefined);
    setViewIndex(0);
  }

  function start(nextPreferences = preferences): void {
    restart(nextPreferences);
  }

  function abandon(): void {
    setSession(null);
    setLatestAttempt(undefined);
    setViewIndex(0);
  }

  return {
    session,
    latestAttempt,
    viewIndex,
    summaryAttempts,
    submit,
    reveal,
    previous,
    next,
    restart,
    start,
    abandon,
  };
}
