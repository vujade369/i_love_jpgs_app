<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# I Like JPGs Agent Notes

This repo is `i_like_jpgs_app`.

Do not assume this is the older `collector-chemistry-main` repo. Before making changes, inspect the files that exist in this repo.

## Product Direction

I Like JPGs is about reading public NFT collecting behavior as cultural signal and taste, not financial value.

The product should feel:

- playful
- clear
- social
- taste-led
- lightly toy-like
- editorial without becoming heavy

Avoid turning the app into:

- a finance dashboard
- a trading tool
- a valuation report
- a generic NFT analytics product
- a social profile/contact system

## Language Rules

Prefer:

- this wallet
- this wallet set
- visible holdings
- visible collection signals
- public identity
- public wallet metadata
- JPGs read
- collections found
- included wallets

Avoid:

- your wallet
- your profile
- your collection
- owner
- verified identity
- complete identity
- real identity
- follow
- message
- contact
- floor
- value
- worth
- investment
- profit
- trade

## Codex Skills

Before starting a task, check whether a relevant Codex skill should be used.

Known installed/global skills may include:

- `frontend-design`
- `web-design-guidelines`
- `vercel-react-best-practices`

Use them selectively:

- UI, layout, visual hierarchy, responsive design → `frontend-design`, `web-design-guidelines`
- Next.js, React, TypeScript, app-router implementation → `vercel-react-best-practices`

Do not invoke every skill by default. Use only the skills relevant to the task.

If available skills differ from this list, report the mismatch before implementing.

## Local Repo Docs

Check relevant docs before implementation:

- `docs/WALLET_READ_PRODUCT_RULES.md`
- `docs/WALLET_READ_IDENTITY_LAYER.md`
- `.agents/skills/wallet-read-foundation.md`

If a referenced doc does not exist, say so and continue with the closest available repo context.

## Implementation Principles

Prefer small, reversible changes.

Before adding new API fields, inspect the existing data path.

Before refactoring, explain why the existing structure is insufficient.

Do not add new fetches, dependencies, endpoints, or abstractions unless the task clearly requires them.

For UI changes, preserve the existing visual language unless asked to redesign.

For data/API work, avoid slowing down wallet reads materially.

## Verification

After code changes, run:

```bash
npx tsc --noEmit
git diff --check