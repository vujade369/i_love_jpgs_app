# Wallet Read Foundation

Use this skill when working on Wallet Read in I Like JPGs.

Relevant files:

- app/wallet/page.tsx
- app/api/wallet/read/route.ts
- app/api/wallet/suggest/route.ts
- lib/jpgs/opensea.ts
- lib/jpgs/classifyNftTaste.ts
- docs/MILESTONE_1_COMPLETION_PLAN.md
- docs/WALLET_READ_PRODUCT_RULES.md
- docs/process/SPRINTS.md
- docs/process/sprints/SPRINT_1_WALLET_READ.md

## Product Intent

Wallet Read is a cultural read of visible NFT collecting behavior.

It helps someone recognize patterns in what they collect.

It is not:

- a portfolio tracker
- a valuation tool
- a rarity explorer
- a trading tool
- a ranking system
- a psychological diagnosis
- a social score

## Current Milestone

Milestone 1 is focused on completing the wallet read foundation.

Current working baseline:

- single-wallet read works
- JPG Match still works
- wallet identity suggestions work
- multi-wallet read has not been implemented yet
- archive, timeline, and taste-room modules have not been implemented yet

The next priority is planning and then implementing multi-wallet support:

- accept multiple wallets
- preserve wallet set in URL
- show wallet chips
- support add/remove wallet
- dedupe NFTs across wallets
- preserve source-wallet metadata
- keep the read feeling like one collector read

## Language Rules

Use:

- suggests
- appears
- leans
- points toward
- visible signal
- collection pattern
- repeat collecting
- anchor
- archive
- room
- thread

Avoid:

- proves
- best
- most valuable
- floor
- offer
- ROI
- alpha
- smart money
- whale
- elite
- ranked
- superior

## Interpretation Rules

Every interpretation should be grounded in visible wallet behavior.

Good:

> This wallet leans toward meme culture because several of its strongest collection anchors come from meme-native projects.

Bad:

> You are a meme maximalist.

Use careful interpretive language.

Do not make identity claims.

Do not make market claims.

Do not describe the wallet as financially smart, valuable, rare, elite, or superior.

## Multi-Wallet Rules

- Combined reads should feel like one collector, not several reports stapled together.
- Wallet chips should make included sources clear.
- Source-wallet attribution should clarify, not dominate.
- Duplicate NFTs should not inflate counts.
- Dedupe NFTs by chain + contract address + token identifier.
- Keep single-wallet behavior backwards compatible.
- The first wallet is the default identity anchor unless changed later.
- Multi-wallet support should not become wallet comparison.
- Multi-wallet support should not rank the user’s wallets against each other.

## URL and State Rules

For multi-wallet work:

- Preserve the wallet set in the URL.
- Keep existing single-wallet URLs working.
- Prefer readable URL params over hidden state.
- Do not introduce accounts or persistence.
- Do not store wallet sets server-side.
- Do not require wallet connection.

## Visual Rules

- Objects first.
- Interpretation second.
- Metrics only when useful.
- Avoid dashboard density.
- Avoid finance UI.
- Use collection images where available.
- Use NFT thumbnails as proof, not decoration.
- Do not render the entire wallet.
- Curate previews.
- Wallet chips should be visible but not visually dominant.
- Keep the current page structure unless the task explicitly asks for a redesign.

## Data Rules

- Use visible NFTs only.
- Preserve collection-level display names where available.
- Preserve collection-level images where available.
- Do not use sample NFT images as collection images unless collection metadata has no image.
- Keep source-wallet metadata available on normalized NFT records when implementing multi-wallet support.
- Keep debug data useful in development.
- Missing metadata should degrade gracefully.

## Scope Guardrails

Do not build:

- wallet comparison
- match feed
- messaging
- accounts
- saved profiles
- claiming flow
- privacy controls
- archive module
- timeline module
- taste-room module
- AI interpretation
- valuation
- floor prices
- offers
- rarity
- trading language
- broad redesign

## Implementation Bias

Prefer:

- small, reviewable changes
- clear TypeScript types
- backwards-compatible response shapes
- simple URL state
- predictable dedupe logic
- graceful error states
- minimal UI changes for foundation work

Avoid:

- large refactors
- new dependencies
- clever type gymnastics
- redesigning the page during foundation work
- mixing Milestone 1 Track 1 with later archive/timeline work

## QA

After edits, run:

```bash
npx tsc --noEmit