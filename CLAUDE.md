# CLAUDE.md

## Project

This repo is for **I Like JPGs**, a taste-based NFT wallet interpretation product.

The product reads public wallet activity as cultural signal. It is not a finance dashboard, trading tool, or status-ranking product.

The core experience should feel:

* playful but not gimmicky
* editorial but not heavy
* human and interpretive
* restrained, minimal, and slightly toy-like
* focused on taste, overlap, collecting behavior, and visible cultural signals

## Product Principles

Follow these principles when making product, UI, copy, or data decisions:

* A wallet is a constellation of visible signals.
* Interpret behavior, not identity.
* Show proof near claims.
* Use language like “suggests,” “appears,” “signals,” and “visible overlap.”
* Avoid absolute judgments.
* Avoid ranking people by worth, status, taste quality, or financial value.
* Market data can provide context, but should not become the center of the product.
* The product should feel social, curious, and comparison-friendly without becoming creepy or shallow.

## Voice and Copy

Write copy that feels:

* clear
* warm
* sharp
* conversational
* editorial
* specific

Avoid:

* generic startup language
* hype
* “journey”
* “passionate”
* “unlock”
* “revolutionize”
* stiff SaaS language
* overexplaining
* possessive or overly intimate claims
* finance-first framing

Prefer:

* “visible signals”
* “shared taste”
* “overlap”
* “collecting patterns”
* “what shows up”
* “nearby collectors”
* “signal”
* “read”
* “constellation”

## Design Direction

The visual direction should be:

* minimal
* editorial
* architectural
* restrained
* quietly premium
* playful in small details
* symbolic over decorative

Avoid:

* cluttered dashboards
* generic Web3 gradients
* excessive glow
* heavy card spam
* overly corporate SaaS UI
* finance/trading interface patterns

Use existing visual patterns before inventing new ones.

## Engineering Defaults

Use the existing stack and patterns in the repo.

Before making changes:

1. Inspect the relevant files.
2. Identify the smallest safe scope.
3. Preserve existing behavior unless asked to change it.
4. Do not touch unrelated files.
5. Avoid broad refactors unless explicitly requested.
6. When in doubt about product intent, module ownership, or product rules, check the project docs first — especially `docs/DECISIONS.md` and `docs/WALLET_READ_PRODUCT_RULES.md`.

When editing:

* Prefer simple, readable code.
* Preserve existing API contracts.
* Keep frontend-only changes frontend-only.
* Do not change ranking, matching, result-count caps, or filtering logic unless the task explicitly asks for it.
* Do not silently rename user-facing concepts.
* Do not add new dependencies unless clearly necessary.
* Do not add comments unless they clarify non-obvious logic.

## Module Boundaries

Respect the product module boundaries.

* Wallet Read owns `/wallet` and `/api/wallet/**`.
* JPG Match owns `/jpgs`, `/jpgs/results`, and `/api/jpgs/**`.
* Shared business logic lives in `lib/jpgs/`.
* Do not reach across module boundaries unless the task explicitly requires it.
* When a change affects both modules, state that clearly before editing.

## Data and Display Rules

Collection display:

* Use collection-level image/avatar metadata when available.
* Do not use a sample NFT image as the collection image unless there is no collection-level image.
* Use the front-facing collection display name from metadata/OpenSea when available.
* Raw slugs are internal identifiers or final fallbacks.

Identity display:

* Prefer ENS or meaningful display names where available.
* Preserve avatar URLs from account/profile sources.
* Do not discard identity data when adding resolve data.

NFT visibility:

* Respect visible/public NFT filtering rules.
* Do not reintroduce hidden/spam NFTs into downstream display.
* Be careful with institutional wallets, marketplace wallets, and contract-like entities.

## Important Product Areas

Pages:

* `/` (home — wallet input and landing state)
* `/wallet`
* `/jpgs`
* `/jpgs/results`

API routes:

* `/api/wallet/read`
* `/api/wallet/similar-collectors`
* `/api/wallet/suggest`
* `/api/jpgs/collections/search`
* `/api/jpgs/holders`
* `/api/jpgs/wallets/discover`

Business logic:

* `lib/jpgs/`

This includes taste classification, scoring, OpenSea helpers, holder discovery, institutional wallet detection, and shared JPG-related utilities.

When working on one surface, do not change another unless the task requires it.

## Verification

For local development, use:

```bash
npm run dev
```

Do not run `next dev` directly. The project dev script includes the macOS cache artifact cleanup step.

After code changes, run:

```bash
npx tsc --noEmit
git diff --check
```

Also run:

```bash
npm run lint
```

When touching taste classification logic, category logic, or related files such as `lib/jpgs/classify*` or `tasteCategories`, run:

```bash
npx tsx scripts/test-jpgs-classifier.ts
```

When useful, also run relevant local API checks or page checks.

Always return:

* short summary of changes
* files changed
* verification results
* any risks, assumptions, or follow-up recommendations

## Working Style

Be scoped and explicit.

For every task:

* Restate the intended change briefly.
* Identify what is intentionally out of scope.
* Make the smallest coherent edit.
* Preserve current behavior unless the user asked to change it.
* Do not make copy changes during layout tasks unless explicitly requested.
* Do not make layout changes during copy-only tasks unless explicitly requested.

If something seems ambiguous, make a reasonable assumption and state it. Do not stall unless the ambiguity could cause a destructive or hard-to-reverse change.
