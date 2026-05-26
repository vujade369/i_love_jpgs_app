# Sprint 1 — Wallet Read

Status: Planned

## Sprint Goal

Build the first single-wallet read for I Like JPGs.

A user should be able to enter a wallet address and get a lightweight, culturally interesting taste profile based on visible NFT collection signals.

The goal is not to produce a perfect identity read. The goal is to prove that a wallet can feel like a useful cultural mirror.

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

See what a wallet seems to care about, based on what it collects.

## Scope

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

## Proposed Route

- page: /wallet
- API: /api/wallet/read

## First Version Profile Sections

### Wallet Header

- shortened wallet address
- optional resolved display name if available
- total visible NFTs
- total collections

### The Read

A short, grounded summary using careful language.

Rules:

- use suggests, leans, appears
- interpret collecting behavior, not identity
- avoid status language
- avoid market language

### Top Collections

- collection image
- collection display name
- count held
- OpenSea link

### Taste Signals

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

### Proof

Visible proof should sit near claims. If the read says generative, users should see the collections that caused that interpretation.

## Acceptance Criteria

Sprint 1 is done when:

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

## QA Checklist

Run:

    npx tsc --noEmit

Manual checks:

- valid wallet with NFTs returns a profile
- valid wallet with few or no NFTs shows a useful empty state
- invalid wallet shows an error
- collection names are readable
- collection images are not random NFT thumbnails unless used as fallback
- OpenSea links work
- page does not mention floor, rarity, offers, value, or trading

Test wallets:

- 0x5ffd8de19910efff95df729c54699aebcee8f747
- one wallet with many recognizable collections
- one wallet with sparse holdings
- one invalid address

## Build Order

1. Create wallet read page.
2. Create wallet read API route.
3. Fetch visible NFTs.
4. Normalize collection display data.
5. Calculate top collections.
6. Add simple category grouping.
7. Render profile sections.
8. Add loading, empty, and error states.
9. Run QA and commit.

## Implementation Notes

Start boring.

The first version should be a readable profile, not a magical interpretation engine.

Avoid adding AI interpretation until the raw signals feel trustworthy. If the structured output is weak, AI copy will only hide the weakness.

## Sprint Risks

### Risk: The read overclaims.

Mitigation: Use careful language and show proof near every interpretive claim.

### Risk: Collection metadata is messy.

Mitigation: Prefer collection-level metadata. Use fallback images only when necessary.

### Risk: The module becomes too similar to JPG Match.

Mitigation: JPG Match discovers other wallets from selected collections. Wallet Read explains one wallet from its holdings.

### Risk: We drift into market framing.

Mitigation: No value, offer, floor, rarity, or trading language.

## Demo Script

1. Enter a wallet.
2. Show the wallet header.
3. Explain the read.
4. Point to proof through top collections.
5. Show taste signals.
6. Explain what would come next: comparing two wallets.

## Open Decisions

- Should ENS support be included now or later?
- Should the first read use only structured logic, or include AI after the core profile works?
- What minimum number of visible NFTs is enough for a useful read?

## Implementation Log

### 2026-05-26 — First vertical slice shipped

- Added /wallet page.
- Added /api/wallet/read route.
- Added fetchWalletNfts helper in lib/jpgs/opensea.ts.
- Reused collection metadata and taste classification helpers.
- Verified TypeScript passes.
- Verified valid wallet API response returns topCollections and tasteSignals.
- Verified invalid wallet states return errors.
- Confirmed JPG Match collection search still returns expected results.
