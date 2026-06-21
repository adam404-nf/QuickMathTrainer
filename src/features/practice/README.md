# Practice

Owns one Flashcard practice session.

Responsibilities:

- Track the current question, answer input, feedback state, and question order.
- Measure per-question time and decide when a session ends.
- Request questions from `features/questions`.
- Send attempts to `features/results`.
- Own practice-specific UI such as question cards, answer input, feedback, and next-question actions.

This module should not know how individual question types generate their values.
