# Definition of Done

A change is done when it is working, tested, documented where needed, and committed cleanly.

## For Code Changes

- TypeScript passes.
- The touched module still works.
- Regression QA passes if behavior changed.
- No unrelated files are committed.
- No financial framing is introduced unless explicitly intended.
- Error and fallback states are acceptable.
- The commit message describes the change plainly.

## For Module Changes

- Module doc is updated.
- Owned routes and API endpoints are clear.
- Non-goals are clear.
- QA expectations are clear.
- Shared dependencies are identified.
- The module can be tested independently.

## For Product Decisions

- Decision is recorded in `docs/DECISIONS.md`.
- Reason is written plainly.
- Tradeoff is acknowledged if relevant.

## For UI Changes

- The page still has a clear primary action.
- Copy is clear and not over-explained.
- Visual changes support the product loop.
- Empty/loading/error states do not feel broken.
- No market, rarity, valuation, or trading language appears unintentionally.