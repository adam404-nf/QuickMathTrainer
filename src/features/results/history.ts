import { createSessionSummary } from "./summary";
import type { Attempt, PracticeHistoryEntry } from "./types";
import type { Difficulty, PracticeMode } from "../questions/types";

interface CreateHistoryEntryInput {
  id: string;
  mode: PracticeMode;
  difficulty: Difficulty;
  startedAt: string;
  endedAt: string;
  attempts: Attempt[];
}

export function createHistoryEntry(input: CreateHistoryEntryInput): PracticeHistoryEntry {
  return {
    ...input,
    summary: createSessionSummary(input.attempts),
  };
}

export function prependHistoryEntry(
  history: readonly PracticeHistoryEntry[],
  entry: PracticeHistoryEntry,
  limit = 20,
): PracticeHistoryEntry[] {
  return [entry, ...history].slice(0, limit);
}
