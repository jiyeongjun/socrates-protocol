# Verify And Repair

1. Run the narrowest relevant observable check.
2. If it passes, widen only as the affected risk requires.
3. If it fails, summarize the evidence, repair the smallest relevant issue, and retry.
4. Stop after two bounded repair attempts or when failure exposes a missing decision/authority.
5. Keep verification separate from closure: a passing check does not prove subcontract criteria or macro success automatically.

- Do not broaden production semantics or add fallbacks only to satisfy a test.
- Do not hide unrelated failures or weaken checks for green status.
- Record commands, exit status, concise evidence, blockers, and next action—not execution micro-reasoning.
- Use a read-only closure evaluation for protected, cross-boundary, or multi-step work before marking it done.
