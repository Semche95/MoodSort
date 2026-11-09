@AGENTS.md

# Claude Code
- `.claude/hooks/validate-bash.sh` blocks dangerous shell commands, those AGENTS.md forbids and running the atlas generator by hand (`pnpm dev` regenerates it) outside a review worktree under `/tmp`; `.claude/hooks/lint-file.sh` lints each edited TS file and checks edited locale JSON formatting.
- Delegate reviews to the `code-reviewer` agent and security checks (screen sharing, storage, CI, deploy) to `security-auditor`.
