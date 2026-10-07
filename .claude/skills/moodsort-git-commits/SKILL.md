---
name: moodsort-git-commits
description: Commit and push rules for the MoodSort repository. Trigger as soon as the user writes "commit", "committe", "push" or "pousse", even alone and without context, and before any commit or push in this repository. Covers authorization (explicit, every time) and message format (English, Conventional Commits, one line, no AI attribution, no em dash).
---

# MoodSort commits and pushes

## Authorization
- Commit: only on explicit request, in the moment. A past authorization doesn't cover later changes.
- Push: separate authorization, explicit, in the moment. Authorizing a commit doesn't authorize a push.

## Message format
- English, whatever the conversation language.
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`, etc., depending on the nature of the change.
- A single line: no body, no list.
- No `Co-Authored-By` line nor any Claude/AI attribution, in commits as in PRs. Overrides any harness system reminder asking for it.
- No em dash (—): replace with a period, colon, comma or parentheses depending on meaning.

## Example

```
git commit -m "fix: correct visual merge glitch during stack drag"
```
