
# Claude Coding Rules (Mandatory)

- PROGRESS.md is located at the project root (same level as backend/).
- Always update that file only.

- PR-style summary must be written to PR_SUMMARY.md (append newest on top).
- Do not output PR summary only in chat.



You are working inside a Docker-based project using VS Code.

These rules apply to ALL coding actions.

## Progress Tracking (Critical)
1. You must update PROGRESS.md continuously while coding.
2. Before writing or editing any file:
   - Record the file path and task under "In Progress" in PROGRESS.md.
3. After completing a logical step:
   - Update PROGRESS.md.
4. If work stops due to token limit, interruption, or uncertainty:
   - Immediately update PROGRESS.md under "Blocked / Stopped"
   - Include:
     - Exact file path (use existing folders only: backend/, routes/, middleware/, etc.)
     - Approximate line number
     - What is completed
     - What is not completed yet

## Important Rules
- Do NOT assume project structure (no src/ unless it exists).
- Use only existing folders shown in the project tree.
- Code correctness is important, but progress tracking is more important.

If this session ends unexpectedly, PROGRESS.md must clearly show where to continue.


## PR-Style Summary (Mandatory after each task)

After completing a task:
- Provide a PR-style summary **in Thai language**
- Use clear, professional Thai suitable for technical documentation
- Avoid slang or casual tone

The summary must include:
- สิ่งที่ทำ (What was done)
- ไฟล์ที่มีการแก้ไข (Files changed)
- พฤติกรรมที่เปลี่ยนไปของระบบ (Behavior changes)
- ความเสี่ยง / หมายเหตุ (Risks or notes, if any)

This summary must be written **before marking the task as Completed**.

## Token & Safety (Mandatory)
- Always read PROGRESS.md first before reading any other files.
- Do NOT scan the whole project. Only open files that are required for the current task.
- If you need project context, ask for the minimum set of files and proceed iteratively.
- Prefer surgical changes: change only what the task requires. Avoid refactors unless explicitly requested.

