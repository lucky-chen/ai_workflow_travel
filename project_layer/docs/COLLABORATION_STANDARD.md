# Collaboration Standard

This document defines the shared collaboration standard for all work under `project_layer`.

## 1. Change Plan First

- Before making any code change, Codex must first provide a short change plan for review.
- The change plan must include:
  - target
  - involved files
  - specific change items
  - risks or open questions
- expected validation method
- Codex may start file edits only after the user explicitly approves the plan.
- Documentation-only edits may be made directly without a pre-review change plan.

## 2. Work That Does Not Require Approval

- Reading code, reading documents, and doing analysis do not require approval.

## 3. Plan Maintenance

- After each completed chunk of implementation work, Codex must automatically update the execution plan and check off the corresponding completed items.
- Only tasks that are actually implemented and verified may be checked off.

## 3.1 Code Organization Standard

- All generated code must follow the same readability and maintainability standard used during manual refactoring.
- Avoid placing multiple unrelated behaviors into one oversized function when they can be expressed as small focused functions.
- For test files, prefer one entry function plus multiple small test-case functions grouped by behavior.
- New generated code should default to clear structure first, not just minimal line count.

## 3.2 Incremental Change Rule

- If a requested change is too large, Codex must split it into multiple independent batches instead of submitting one large modification at once.
- Each batch should remain independently understandable, reviewable, and verifiable.
- Avoid mixing unrelated refactors, behavior changes, and architecture adjustments into the same batch when they can be separated.
- Do not submit one oversized change set when the work can be delivered in smaller reviewable increments.

## 4. Git Commit Rule

- After each completed round of engineering file changes, Codex must create one git commit.
- Commit messages must be written in English.
- Human-authored commits must use the first line format: `[Human]: <summary>`
- AI-authored commits must use the first line format: `[AI] <Model>: <summary>`
- Commit details must start from the second line and describe the scope of the current change.
- Commit details must explicitly follow this format:
  - `Target: <target>`
  - `Items:`
  - `1. <item one>`
  - `2. <item two>`
- Add more numbered items when needed.
- Example human commit:
  - first line: `[Human]: refine implementation stage plan`
  - details:
    - `Target: execution plan management`
    - `Items:`
    - `1. Update plan scope.`
    - `2. Update step tracking.`
- Example AI commit:
  - first line: `[AI] gpt-5.4: add stage registry validation`
  - details:
    - `Target: pipeline stage registry`
    - `Items:`
    - `1. Cover duplicate registration.`
    - `2. Cover next stage validation in pipeline flow.`
- The commit message should be a concise summary of that round of changes.

## 5. Recommended Git Permission Rules

- To avoid repeated permission prompts for normal collaboration, prefer approving stable git command prefixes instead of one-off commands.
- Recommended prefixes to approve:
  - `["git", "add"]`
  - `["git", "commit"]`
  - `["git", "status"]`
- These prefixes cover the normal edit-review-commit workflow with limited scope.
- Do not broadly auto-approve all `git` commands.
- Do not auto-approve destructive or remote-affecting commands such as `git reset`, `git checkout`, or `git push` unless explicitly intended.
