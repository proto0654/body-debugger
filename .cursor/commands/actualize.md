# actualize

Role: Technical Writer and Software Architect.  
Task: Update Body Debugger documentation from the recent conversation and diff.

If this file disagrees with the global `actualize` skill, **this file wins**.

## 0. Git hygiene (run first)

1. Run `git status -sb` (and `git diff` if useful).
2. If there are **uncommitted** changes from this conversation:
   - Summarize what changed (1–3 bullets).
   - Propose a Conventional Commit message.
   - **Ask** whether to commit now (unless the user already asked to commit).
3. Do not invent release/deploy steps that are not documented in [docs/DEVELOPMENT.md](../../docs/DEVELOPMENT.md).

---

## 1. Analyze

Review the conversation and the diff. Identify which **documented behavior** changed — not merely which files were touched.

---

## 2. Update docs (targeted; keep hubs slim)

1. **Domain docs** under `docs/` — update the owning file (`ARCHITECTURE`, `DEVELOPMENT`, `ROADMAP`, …).
2. **[docs/CONTEXT.md](../../docs/CONTEXT.md)** — only if a **permanent** fact changed (paths, stack, current focus, language rules). No session changelog.
3. **[docs/README.md](../../docs/README.md)** — TOC only. Add a row if a **new** doc was created. Never append “Recent changes”.
4. **[CONCEPT.md](../../CONCEPT.md)** — only when the user explicitly changes product rules; keep Russian; do not machine-translate.
5. Put non-obvious gotchas in the domain doc closest to the change (often `DEVELOPMENT` for cache/Electron, `ARCHITECTURE` for IPC/domain).

Do not resurrect deleted docs. Do not duplicate CONCEPT into English unless asked.

---

## Output

- Docs edits: **English** (except CONCEPT.md).
- Chat: **Russian**.

End with:

```
Docs status
- Files updated: …
- Suggested commit: …
- Verification: …
```

Ask before committing unless the user already requested a commit.
