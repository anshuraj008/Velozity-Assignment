# Project continuity

Read HANDOFF.md before starting work. Follow the user's current requirements and preserve existing work.

- Before a substantial task, record the intended change and next steps in HANDOFF.md.
- Update HANDOFF.md after each meaningful milestone and before ending a session: completed work, partial edits, remaining tasks, relevant files, commands run and their actual results, and blockers.
- Keep checkpoints concise and factual. Never mark untested work as verified. Do not wait until a token or usage limit warning to save progress.
- Record confirmed project requirements and decisions here or in linked project documentation as they become available. Do not depend on chat history being available to the next agent.
- On resuming, inspect actual files and, if Git is initialized, git status and git diff. Reconcile them with the handoff because an interruption may leave newer or incomplete edits.
- Preserve unrelated changes. Finish or repair partial edits before starting another feature. Run the relevant available checks and report failures honestly.
- Document setup, dependency versions, environment variable names (never secrets), and build/test commands once the application exists. Preserve dependency lockfiles.
- Only one coding tool should edit this workspace at a time during a handoff.
- If a usage warning is visible, save a checkpoint and tell the user how to resume. Do not claim access to account quota, automatic cross-provider switching, or guaranteed notifications without a working integration.

These instructions support manual continuation across coding tools. They do not implement automatic failover or guarantee error-free code.
