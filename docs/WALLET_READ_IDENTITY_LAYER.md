# Wallet Read Identity Layer

## Purpose

Wallet Read should use public wallet identity metadata to make a read more recognizable without assuming ownership of the wallet.

A person may use Wallet Read to:

- read one of their own wallets
- combine a main wallet and vault
- look up a friend, artist, collector, or public wallet
- inspect a wallet discovered through JPG Match

The page should feel specific to the wallet or wallet set being read, but it should not speak as if the viewer owns the wallet.

The identity layer exists to answer:

> Which wallet or wallet set is being read, and how can it be recognized quickly?

It should not turn Wallet Read into a social profile, contact page, or identity verification system.

---

## Core Principle

Public identity, not personal possession.

Use public metadata from OpenSea, ENS, and wallet resolution to make the read recognizable.

Do not imply:

- the viewer owns the wallet
- the wallet identity is verified
- the app knows who controls the wallet
- the read describes the human behind the wallet
- public profile links are an invitation to contact someone

The wallet address should remain visible as proof and fallback.

---

## What This Layer Can Use

Use these public fields when available:

- OpenSea display name
- OpenSea username
- ENS name
- wallet avatar / profile image
- wallet address
- shortened wallet address
- OpenSea profile URL
- public profile links exposed by OpenSea, if available cleanly

Optional profile links may include:

- website
- X / Twitter
- Instagram
- Discord
- other public profile links returned by the existing account source

Only render these links when they are explicitly available from public account metadata.

Do not infer, scrape, guess, or construct social links from usernames unless the source data clearly supports it.

---

## What This Layer Should Not Do

Do not add:

- wallet claiming
- account creation
- messaging
- following
- contact actions
- private identity inference
- social graph features
- verification badges unless backed by a real verification field
- any financial, rarity, offer, floor, trading, or valuation framing

Do not present OpenSea display names, avatars, ENS names, or social links as proof of real-world identity.

They are public profile metadata only.

---

## Language Rules

### Use

- this wallet
- this wallet set
- selected wallet
- included wallets
- public profile
- public identity
- identity anchor
- OpenSea profile
- visible holdings
- visible collection set
- combined read
- individual read

### Avoid

- your wallet
- your profile
- your collection
- your JPGs
- your vault
- you collect
- follow this collector
- connect with them
- message them
- verified identity
- owner
- complete identity
- full identity
- real identity

---

## Header Behavior

The identity layer should primarily affect the Wallet Read header.

It should make the active read immediately recognizable while preserving the existing read structure.

### One-Wallet Read

Show:

- label: `Wallet Read`
- avatar/profile image if available
- display name if available
- ENS or username if available
- shortened wallet address
- full address only where useful or already present

Fallback order for the main identity label:

1. display name
2. ENS
3. username
4. shortened address
5. full address

Secondary identity line should prefer:

1. ENS + shortened address
2. username + shortened address
3. shortened address
4. full address

Do not use possessive framing.

Good:

> Wallet Read  
> Vuja_De  
> vuja-de.eth · 0x5ffd...f747

Avoid:

> Your Wallet  
> Your profile  
> Your collection

---

### Combined Read

A combined read may represent multiple wallets from one collector, or it may simply be two public wallets someone chose to inspect together.

Do not assume both wallets belong to the same person.

Show:

- label: `Combined Read`
- identity anchor from the first included wallet
- compact mention of the second included wallet
- avatars for included wallets if available
- number of included wallets
- shortened addresses as proof

The first wallet remains the identity anchor unless the product later introduces a way to choose the anchor.

Good:

> Combined Read  
> Vuja_De + Vuja_De_Vault  
> 2 included wallets  
> 0x5ffd...f747 · 0x16f3...5e61

Avoid:

> Complete collector profile  
> Their full identity  
> Your complete collection

---

### Individual View From a Wallet Set

When the user switches from Combined to Wallet 1 or Wallet 2, show the selected wallet’s identity.

Show:

- label: `Individual Read`
- avatar/profile image if available
- selected wallet display name / ENS / username / short address
- secondary line with ENS or username plus short address
- line clarifying this is one selected wallet from the included set

Good:

> Individual Read  
> Vuja_De_Vault  
> vujas-vault.eth · 0x16f3...5e61  
> Selected wallet from 2 included wallets.

Avoid:

> Your vault  
> Your second wallet  
> This collector’s full identity

---

## Wallet Chips

Wallet chips should remain compact.

They can show:

- display name / ENS / username / short address
- avatar if it fits without clutter
- identity anchor marker for the first wallet
- remove action

Wallet chips should not become full profile cards.

They should support orientation, not dominate the read.

---

## Public Profile Links

Public profile links are optional.

Before implementing them, inspect what account metadata is actually available from the existing OpenSea account fetch / resolve path.

Profile links should only render if they are returned cleanly by the source.

Allowed link types:

- OpenSea profile
- website
- X / Twitter
- Instagram
- Discord
- other explicitly returned public links

Rules:

- Do not guess links.
- Do not construct social URLs from display names.
- Do not show empty link rows.
- Do not render broken links.
- Do not add follow/message/contact CTAs.
- Keep links visually secondary.
- Limit the row to a small number of useful links.
- Prefer text links over loud social buttons.

Good:

> OpenSea · Website · X

Avoid:

> Follow  
> Message  
> Connect  
> Contact this collector

---

## Trust and Safety Notes

OpenSea display names, usernames, avatars, ENS names, and public profile links are user-controlled or externally controlled metadata.

Wallet Read may display them, but should not treat them as verified identity unless a reliable verification signal exists.

Always preserve a wallet address or shortened address near the identity layer so the read remains grounded in the public wallet being inspected.

If identity metadata is missing, the read should still work with address fallback.

If profile images fail to load, use a restrained fallback.

If two wallets have weak or missing identity metadata, the combined read should still be legible through wallet chips and shortened addresses.

---

## Data Handling Rules

Use existing identity metadata first.

Before adding new API fields, check:

- whether `sourceWallets` already includes the needed field
- whether `resolveWalletIdentity` already parses the field
- whether `fetchAccount` already receives the field
- whether `accountToSuggestion` or similar helpers already normalize the field

Prefer small additions to existing identity normalization over new endpoint complexity.

Do not refactor `/api/wallet/read` unless identity metadata is unavailable and the smallest safe change requires it.

Do not add extra wallet NFT fetches for identity.

Do not slow down the read materially for social links.

If public profile links are expensive or unreliable, defer them.

---

## Suggested Implementation Order

### Pass 1 — Identity Header

Add:

- avatar/profile image in the main header
- display name / ENS / username / short address fallback
- selected wallet identity for individual views
- compact combined identity treatment
- address proof remains visible

This pass should use existing `sourceWallets` data where possible.

### Pass 2 — Public Profile Links

Inspect account metadata first.

If clean public profile links are available:

- expose optional profile links through the existing identity data path
- render a restrained link row in the header
- hide the row when no links exist

If links are not available cleanly, document the finding and defer.

---

## Acceptance Criteria

The identity layer is working when:

- one-wallet reads show recognizable public identity when available
- combined reads show which wallets are included
- individual views show the selected wallet’s identity
- avatar/profile images render when available
- address fallback works when identity metadata is missing
- the wallet address or short address remains visible
- no possessive language is introduced
- no verification is implied without a real verification signal
- public profile links render only when explicitly available
- no empty identity or link modules render
- existing wallet chips, active view controls, suggestions, add/remove behavior, URL behavior, empty states, and error states still work
- `npx tsc --noEmit` passes

---

## QA Checklist

Run:

```bash
npx tsc --noEmit
git diff --check