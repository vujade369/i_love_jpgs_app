# Sprint 1 — Wallet Read

Status: Baseline built / pending Milestone 1 completion

## Sprint Goal

Build the first wallet-read foundation for I Like JPGs.

A user should be able to enter a wallet address and get a lightweight, culturally interesting taste profile based on visible NFT collection signals.

The goal is not to produce a perfect identity read. The goal is to prove that a wallet can feel like a useful cultural mirror.

## Current State

Sprint 1 established the first wallet-read baseline.

A user can enter a wallet and receive a lightweight, non-financial collector read based on visible NFT holdings, collection signals, and basic taste grouping.

The baseline proves the core idea, but the experience is not yet complete enough to close Milestone 1.

Milestone 1 completion now depends on making the read more useful, more explorable, and more collector-native through multi-wallet support, source-wallet clarity, archive-style discovery, stronger proof near claims, and documented QA.

## What Sprint 1 Proved

- A wallet read can be generated from visible NFT holdings.
- Collection-level signals are enough to create a first useful read.
- Top collections and category grouping give the user a quick sense of taste.
- The experience works best when it stays non-financial.
- The next layer is not more metrics — it is memory, proof, multi-wallet clarity, and better collector-native exploration.

## Core Question

Can someone enter one wallet and immediately understand something interesting about what that wallet collects?

## Product Hypothesis

If a wallet read feels accurate, legible, and non-financial, users will be more likely to trust I Like JPGs and eventually connect their own wallet for deeper taste discovery.

## Primary User Flow

1. User enters a wallet address.
2. App fetches visible NFT holdings.
3. App groups holdings into readable collection/taste signals.
4. App renders a simple wallet taste profile.
5. User understands the wallet at a glance.

## User Promise

“See what a wallet seems to care about, based on what it collects.”

## Scope

Build a simple wallet-read module that includes:

- wallet input
- wallet address validation
- visible NFT fetch
- top collections
- collection images
- basic category/taste grouping
- lightweight profile summary
- loading state
- empty state
- error state
- OpenSea links where useful

## Non-Goals

Do not build:

- wallet-to-wallet comparison
- match feed
- messaging
- user accounts
- saved profiles
- claiming flow
- privacy controls
- valuation
- floor prices
- rarity analysis
- offers
- trading recommendations
- AI personality labeling
- psychological identity claims

## Owned Pages

Primary route:

- `/wallet`

Alternative considered:

- `/jpgs/wallet`

Decision:

Use `/wallet` as the primary wallet-read route unless the product architecture changes.

## Owned API Routes

Primary route:

- `/api/wallet/read`

Supporting route if needed:

- `/api/wallet/resolve`

Only add or expand supporting routes when they directly improve wallet resolution, identity display, or user input quality. Do not overbuild.

## Shared Capabilities Used

- OpenSea collection metadata
- wallet NFT fetch
- collection display normalization
- image fallback handling
- category/taste grouping
- OpenSea profile or collection links

## Data Inputs

- wallet address
- ENS where supported
- additional wallets later for Milestone 1 completion

## Data Outputs

A wallet read should return:

- wallet address
- shortened address
- total visible NFTs checked
- total collections found
- top collections
- category groups
- collection image URLs
- collection OpenSea URLs
- lightweight summary signals
- fetch/debug metadata in development

For Milestone 1 completion, the wallet read should also support:

- multiple wallet inputs
- combined wallet count
- per-wallet source context
- deduped NFT count
- source-wallet metadata on normalized NFT records
- combined vs individual wallet views

## First Version Profile Sections

### 1. Wallet Header

Shows:

- shortened wallet address
- optional resolved display name if available
- total visible NFTs
- total collections

### 2. The Read

A short, grounded summary.

Example style:

> This wallet leans toward generative art, long-running collector communities, and recognizable NFT culture. The strongest signals are its repeated collection depth and overlap with established onchain art projects.

Rules:

- Use “suggests,” “leans,” “appears,” not “is.”
- Interpret collecting behavior, not identity.
- Avoid status language.
- Avoid market language.

### 3. Top Collections

Show the most represented collections.

Each item should include:

- collection image
- collection display name
- count held
- OpenSea link

### 4. Taste Signals

Simple grouped labels based on available metadata.

Possible labels:

- Generative
- PFP
- Meme Culture
- Art
- Access
- Gaming
- Collectibles
- Other

Keep this rough. Do not pretend it is definitive.

### 5. Proof

Visible proof should sit near claims.

If the read says “generative,” users should see the collections that caused that interpretation.

## Milestone 1 Experience Direction

Sprint 1 proved the baseline read.

Milestone 1 should make the read feel more like an organized collector archive.

The page should move toward these sections:

### 1. Collector Hero

Immediate recognition.

Shows:

- display name / ENS / shortened wallet
- avatar where available
- wallet chips
- number of wallets included
- one-line collector read

### 2. Wallet Set Controls

Multi-wallet clarity.

Supports:

- add wallet
- remove wallet
- combined read
- individual wallet views
- source-wallet context

### 3. Timeline

Memory and orientation.

Includes:

- First Known NFT
- Latest Arrival
- Deepest Return / strongest collection anchor

### 4. The Read

A grounded interpretation of visible collecting behavior.

Should feel human, specific, and careful.

### 5. Rooms in the Collection

Taste categories as explorable rooms, not abstract chart labels.

Examples:

- Art
- PFPs
- Meme Culture
- Access
- Gaming
- Collectibles
- Other

### 6. Places You Kept Returning

Collection anchors reframed around repeat behavior.

This replaces generic “Top Collections” language where useful.

### 7. From the Archive

A small rediscovery module.

Surfaces older, quieter, or easily forgotten pieces that make the read feel nostalgic and personal.

Selection should favor:

- older acquisitions
- visible images
- pieces not already shown in top modules
- quieter collections
- underrepresented categories
- source-wallet variety in multi-wallet reads

### 8. Small Signals

Lightweight collector-native observations.

Examples:

- “Your vault carries most of the art signal.”
- “This wallet is broader than it is deep.”
- “There is a quiet meme spine running through this collection.”

### 9. Compare CTA

A door into the next product moment.

Should frame comparison as resonance and overlap, not ranking.

## Hand-off to Milestone 1

Milestone 1 should now focus on completing the wallet read experience, not expanding into comparison or matching.

The next work should follow:

- `docs/MILESTONE_1_COMPLETION_PLAN.md`
- `docs/WALLET_READ_PRODUCT_RULES.md`

Priority build tracks:

1. Multi-wallet foundation
2. Combined vs individual wallet views
3. Source-wallet attribution
4. Timeline signals
5. Rooms in the Collection
6. Places You Kept Returning
7. From the Archive
8. Trust and methodology layer
9. QA and milestone exit review

## Sprint 1 Acceptance Criteria

Sprint 1 baseline is done when:

- a user can enter a wallet address
- the app returns a readable wallet profile
- top collections render with names and images
- category/taste signals are visible
- empty wallets do not crash
- failed API calls show a clear error
- loading state feels intentional
- TypeScript passes
- no finance, rarity, offer, or valuation language appears
- the module has a documented QA path

## Milestone 1 Completion Criteria

Milestone 1 is done when:

- a user can enter one wallet and receive a strong read
- a user can add multiple wallets
- the app can render a combined read
- the user can understand which wallets are included
- the user can switch between combined and individual wallet views
- duplicate NFTs are deduped across included wallets
- source-wallet metadata is preserved
- major claims have nearby proof
- the read includes origin, current activity, taste rooms, collection anchors, and archive discovery
- empty, sparse, invalid, and metadata-poor wallets behave gracefully
- the experience remains non-financial
- TypeScript passes
- QA is documented

## QA Checklist

Run:

    npx tsc --noEmit

Manual checks:

- valid wallet with NFTs returns a profile
- valid wallet with few/no NFTs shows a useful empty state
- invalid wallet shows an error
- collection names are readable
- collection images are not random NFT thumbnails unless used as fallback
- OpenSea links work
- page does not mention floor, rarity, offers, value, or trading

Additional Milestone 1 checks:

- multiple wallets can be added
- wallet chips show what is included
- combined view works
- individual wallet views work
- removing a wallet recalculates the read
- duplicate NFTs do not inflate counts
- source-wallet context appears where useful
- archive pieces are not duplicates of the main signal cards
- mobile layout remains usable
- no empty modules render

Test wallets:

- vuja-de.eth / known personal test wallet
- 0x5ffd8de19910efff95df729c54699aebcee8f747
- one main wallet
- one vault wallet
- one third wallet
- combined version of all personal test wallets
- one wallet with many recognizable collections
- one wallet with sparse holdings
- one wallet with missing or weak metadata
- one invalid address

## Definition of Done

- Code is committed separately from docs.
- Module doc is created or updated.
- Sprint doc reflects what was actually built.
- QA passes.
- README links to the new module if the page exists.
- No JPG Match behavior changes unless intentional.

Milestone 1 should not be marked complete until the wallet read feels useful, trustworthy, and interesting enough for a collector to share or compare.

## Build Order

### Sprint 1 Baseline Build Order

1. Decide route path.
2. Create wallet read page.
3. Create wallet read API route.
4. Fetch visible NFTs.
5. Normalize collection display data.
6. Calculate top collections.
7. Add simple category grouping.
8. Render profile sections.
9. Add loading, empty, and error states.
10. Run QA and commit.

### Milestone 1 Completion Build Order

1. Confirm documentation alignment.
2. Implement multi-wallet foundation.
3. Add wallet chips and wallet-set URL state.
4. Preserve source-wallet metadata.
5. Dedupe NFTs across wallets.
6. Add combined vs individual wallet views.
7. Refine page sections around timeline, rooms, anchors, and archive discovery.
8. Add trust and methodology layer.
9. Run full QA.
10. Update docs with what actually shipped.

## Implementation Notes

Start boring.

The first version should be a readable profile, not a magical interpretation engine.

Avoid adding AI interpretation until the raw signals feel trustworthy. If the structured output is weak, AI copy will only hide the weakness.

For Milestone 1, prioritize structure before flourish:

1. multi-wallet support
2. source clarity
3. object-level proof
4. archive discovery
5. copy polish

## Sprint Risks

### Risk: The read overclaims.

Mitigation:
Use careful language and show proof near every interpretive claim.

### Risk: Collection metadata is messy.

Mitigation:
Prefer collection-level metadata. Use fallback images only when necessary.

### Risk: The module becomes too similar to JPG Match.

Mitigation:
JPG Match discovers other wallets from selected collections. Wallet Read explains one wallet from its holdings.

### Risk: We drift into market framing.

Mitigation:
No value, offer, floor, rarity, or trading language.

### Risk: Multi-wallet reads feel like several profiles stapled together.

Mitigation:
Combined profiles should feel like one collector with multiple rooms. Wallet chips and source badges should clarify the source without taking over the page.

### Risk: Archive discovery feels random.

Mitigation:
Use clear selection rules. Favor older, quieter, visually available pieces that are not already doing heavy lifting elsewhere on the page.

## Demo Script

### Sprint 1 Baseline Demo

1. Enter a wallet.
2. Show the wallet header.
3. Explain the read.
4. Point to proof through top collections.
5. Show taste signals.
6. Explain what would come next: comparing two wallets.

### Milestone 1 Demo

1. Enter a main wallet.
2. Show the collector hero.
3. Add a vault wallet.
4. Show the combined wallet chips.
5. Toggle between combined and individual views.
6. Show First Known NFT and Latest Arrival.
7. Open a taste room.
8. Show Places You Kept Returning.
9. Show From the Archive.
10. Explain that the next step is comparing with another collector.

## Open Decisions

- What is the cleanest URL structure for multiple wallets?
- Should wallet labels be user-editable now or later?
- Should ENS support be considered required for Milestone 1?
- Should the first read use only structured logic, or include AI after the core profile works?
- What minimum number of visible NFTs is enough for a useful read?
- Should “From the Archive” be deterministic, randomized, or lightly refreshed?
- How much source-wallet attribution is enough without making the page feel technical?
### 2026-05-26 — Multi-wallet foundation

- Added repeated wallet param support to `/api/wallet/read`.
- Capped Track 1 wallet reads at two wallets.
- Preserved single-wallet balance-based count semantics.
- Added combined read metadata, source wallet records, wallet counts, and dedupe counts.
- Added URL-backed wallet chips on `/wallet`.
- Added add/remove wallet behavior.
- Added invalid-wallet notices for mixed valid/invalid reads.
- Preserved single-wallet read behavior.
- Verified `npx tsc --noEmit` passes.
- Confirmed JPG Match still loads.

