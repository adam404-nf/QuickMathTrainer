import type { PracticeSession } from "../../features/practice/types";
import type { Attempt } from "../../features/results/types";

export const EXIT_PRACTICE_CONFIRM_MESSAGE =
  "確定要結束這輪並返回首頁嗎？目前的進度不會被記錄。";

export function shouldConfirmExitPractice(
  session: PracticeSession | null,
  latestAttempt: Attempt | undefined,
): boolean {
  if (!session || session.status === "finished") {
    return false;
  }

  return session.attempts.length > 0 || latestAttempt !== undefined || session.currentIndex > 0;
}

export function confirmExitPractice(
  session: PracticeSession | null,
  latestAttempt: Attempt | undefined,
  confirm: (message: string) => boolean = window.confirm.bind(window),
): boolean {
  if (!shouldConfirmExitPractice(session, latestAttempt)) {
    return true;
  }

  return confirm(EXIT_PRACTICE_CONFIRM_MESSAGE);
}
