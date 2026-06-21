# Shared Storage

Storage adapters live here.

MVP target:

- Wrap `localStorage` behind a small adapter.

Future replacements:

- IndexedDB
- Backend sync
- Account-based cloud storage

Feature modules should depend on storage behavior, not directly on browser APIs.
