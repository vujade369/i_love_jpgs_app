# I Like JPGs

I Like JPGs is a lightweight collector-discovery app for reading cultural signal from NFT collecting behavior.

The product is not about floor prices, trading, rarity, offers, or portfolio value. It is about what people collect, where taste overlaps, and why those visible collection patterns might be interesting.

## Current Product Loops

### JPG Match

JPG Match lets someone choose a small set of NFT collections and discover wallets that hold meaningful overlap across those collections.

Product loop:

> Pick collections → discover overlapping collectors → understand why the overlap is interesting.

### Wallet Read

Wallet Read lets someone enter a wallet and receive a lightweight, non-financial collector read based on visible NFT holdings, collection anchors, and taste signals.

Product loop:

> Enter wallet → read visible collecting patterns → inspect proof → understand what the wallet seems to care about.

## Current Milestone Focus

### Milestone 0 — JPG Match Foundation

Milestone 0 established the first collection-led discovery loop.

It should continue to prove:

- collection search works
- selected collections feel intentional
- matching wallets appear quickly enough
- overlap is legible
- collector cards feel culturally interesting
- the product avoids finance/trading language

### Milestone 1 — Wallet Read Completion

Milestone 1 completes the wallet read experience.

A user should be able to enter one or more wallets and receive a culturally interesting, non-financial collector read that feels accurate, visual, and worth exploring.

Milestone 1 should prove:

- a user can read one wallet
- a user can add multiple wallets
- a user can switch between combined and individual wallet views
- the read shows actual NFT proof near interpretive claims
- the page includes origin, latest arrival, taste rooms, collection anchors, and archive pieces
- the experience avoids financial, rarity, and trading language
- empty, sparse, invalid, and metadata-poor wallets behave gracefully
- the next action toward comparison is clear

## Owned Surfaces

### Pages

- `app/jpgs/page.tsx`  
  Main JPG Match experience.

- `app/wallet/page.tsx`  
  Wallet Read experience.

### API Routes

- `app/api/jpgs/collections/search/route.ts`  
  Searches OpenSea collections and ranks likely matches.

- `app/api/jpgs/wallets/discover/route.ts`  
  Finds wallets that hold selected collections and returns overlap results.

- `app/api/wallet/read/route.ts`  
  Reads visible NFT holdings for a wallet and returns collection/taste signals.

- `app/api/wallet/suggest/route.ts`  
  Resolves and ranks wallet identity suggestions from handles, ENS names, OpenSea profiles, and wallet addresses.

## Planning Docs

- `docs/process/SPRINTS.md`  
  Sprint index and status tracker.

- `docs/process/sprints/SPRINT_1_WALLET_READ.md`  
  Sprint 1 baseline and Milestone 1 handoff notes.

- `docs/MILESTONE_1_COMPLETION_PLAN.md`  
  Milestone 1 completion plan and checklist.

- `docs/WALLET_READ_PRODUCT_RULES.md`  
  Product rules for keeping Wallet Read cultural, proof-led, and non-financial.

## Product Principles

- Taste over trading.
- Cultural signal over portfolio value.
- Overlap over status.
- Objects first, interpretation second.
- Proof should stay near claims.
- Clear, playful, and understandable.
- No market framing.
- No ranking people by wealth, rarity, or financial performance.
- Collection names and images should feel trustworthy.
- Address fallbacks are acceptable when identity data is unavailable.

## Non-Negotiables

Do not add:

- floor price language
- rarity language
- offer language
- trading language
- portfolio value
- financial advice
- wallet valuation
- “alpha” framing

I Like JPGs should help people understand collecting patterns and cultural overlap, not evaluate financial worth.

## Development Boundaries

Before changing a product surface, check the relevant sprint or milestone doc.

Avoid product drift. For now, do not expand into:

- messaging
- user accounts
- saved profiles
- claiming flow
- privacy controls
- market analytics
- wallet valuation
- collection investment data

If a change affects collection search, holder discovery, wallet read, scoring, or results display, run the relevant QA checklist.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the local dev server:

```bash
npm run dev
```

Run TypeScript checks:

```bash
npx tsc --noEmit
```
