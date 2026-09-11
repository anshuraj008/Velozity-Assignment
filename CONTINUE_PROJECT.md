# Continue with another coding agent

1. Stop the previous coding agent from editing files and save any unsaved editor buffers.
2. Open this same folder in the next tool. If using another machine, transfer all project files and needed local configuration securely; chat history does not substitute for the files.
3. Give the next agent the prompt below and explicitly attach or reference AGENTS.md, HANDOFF.md, and PROJECT_BLUEPRINT.md if it cannot discover them.

## Resume prompt

```text
Continue this project from its current files.
Read AGENTS.md, HANDOFF.md, and PROJECT_BLUEPRINT.md first. Inspect the workspace and, if Git exists,
git status and git diff; reconcile any edits made after the last checkpoint.
Preserve existing work and resolve incomplete edits before proceeding.
Follow the documented requirements in PROJECT_BLUEPRINT.md and next steps in HANDOFF.md.
Run the relevant available checks and record their actual outcomes.
Update HANDOFF.md after each meaningful milestone and before stopping,
including completed work, partial changes, remaining tasks, and blockers.
```

## Limits

This is a manual handoff procedure, not an automatic model switch or quota alert service. Each tool requires its own access and may have its own usage limits. A sudden interruption can occur before a checkpoint is updated, so the next agent must inspect actual files. Verification reduces errors but cannot guarantee their absence.
