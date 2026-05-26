# Scrum Operating Rhythm

I Like JPGs uses a lightweight Scrum-inspired process.

The goal is not process for its own sake. The goal is to keep product work focused, modular, testable, and demoable.

## Sprint Length

Default sprint length: 1 week.

A sprint should produce something observable:

- a working product loop
- a tested module improvement
- a documented decision
- a clearer user-facing experience

## Sprint Shape

Each sprint should include:

1. Sprint Goal
2. Scope
3. Non-goals
4. Tasks
5. Acceptance Criteria
6. QA
7. Demo Notes
8. Retro Notes

## Rules

- Do not start a new module unless the active module still passes QA.
- Do not mix infrastructure, product UX, and experimental ideas in one commit unless necessary.
- Each meaningful change should be commit-sized and reversible.
- Product decisions belong in `docs/DECISIONS.md`.
- Module ownership belongs in `docs/modules/`.
- QA belongs in `docs/REGRESSION_QA.md`.

## Standup Questions

Use these at the start of a work session:

1. What are we trying to prove today?
2. What module are we touching?
3. What should not change?
4. What test proves this worked?
5. What should be committed separately?