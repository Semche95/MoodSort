---
paths:
  - "src/i18n/locales/**"
---

# Locale JSON formatting
- Every JSON file in `src/i18n/locales/` (schema included) stays pretty-printed, 2-space indent, one key per line, trailing newline, never minified, so diffs only show changed lines. Enforced by `src/__tests__/locale-formatting.test.ts`.
- Each locale is validated by `locale.schema.json`.
