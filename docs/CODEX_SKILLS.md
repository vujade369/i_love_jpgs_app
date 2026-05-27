# Codex Skills

## Installed / Global Skills

These are Codex-level skills that may be available outside this repo.

- `frontend-design`
  - Use for UI polish, layout, visual hierarchy, responsive behavior, and taste-level interface critique.

- `web-design-guidelines`
  - Use for web page structure, landing pages, spacing, hierarchy, accessibility, and general front-end design quality.

- `vercel-react-best-practices`
  - Use for Next.js, React, TypeScript, app-router patterns, component structure, and deployment-safe implementation.

## Repo-Local Guidance

For this repo, also check:

- `AGENTS.md`
- `.agents/skills/`
- `docs/WALLET_READ_PRODUCT_RULES.md`
- `docs/WALLET_READ_IDENTITY_LAYER.md`

## Prompt Pattern

When starting a Codex task, include a short skills line:

Use `frontend-design` and `web-design-guidelines` for UI decisions.
Use `vercel-react-best-practices` for Next.js/React implementation.
Follow repo-local docs before making changes.

## Skill Use Rule

Do not invoke every skill by default.

Use skills based on task type:

- UI/layout/page work → `frontend-design`, `web-design-guidelines`
- Next.js/React/TypeScript implementation → `vercel-react-best-practices`
- Product/copy/identity rules → repo docs and `.agents/skills`
- Data/API changes → inspect repo docs first, then make the smallest safe change