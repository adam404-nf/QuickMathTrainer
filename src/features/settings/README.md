# Settings

Owns user preferences and practice options.

Responsibilities:

- Store default practice mode, question count, difficulty, and selected question types.
- Add future preferences such as timer display, mistake-only practice, and challenge options.
- Define product-level settings without directly calling browser APIs.

Persistence should go through `shared/storage`.
