# MVP Scope

## Product contract

The public MVP accepts one or two CS2 Collections and returns one exact best basket for every legal Structure generated from the selected Collection or Collection pair.

The hosted v1 path is C5-only. Market-source expansion is deliberately out of scope for the first release.

## Locked behavior

- One Collection for SINGLE requests, or two distinct Collections for DUAL requests.
- Enumerate all legal Structures for the selected Collection scope.
- Reuse the existing exact solver objective and solving path.
- Return one best result per Structure.
- Preserve infeasible / timeout / error states instead of hiding them.
- Do not filter Structures by ROI, EV, budget, or recommendation policy.
- Do not perform cross-Structure global allocation.

## Non-goals

The MVP will not implement:

- Top-K enumeration
- User-defined budgets or risk constraints
- Trade recommendations
- Auto-buy
- Account or payment systems
- BYO marketplace API keys
- Local marketplace agents
- Multi-market price routing
- Three-or-more-Collection requests
- Daily publication behavior

## Runtime policy

The public service must yield to the private Daily and own-trading workloads.

Initial policy:

- External solve concurrency: **1**
- Additional solve requests: queued
- Approximately **4 hours per day** reserved for maintenance / Daily priority work
- Public requests must not have purchase or publication authority

## Performance envelope

The initial operating target is:

- ≤120 seconds: ideal
- 120–180 seconds: acceptable
- >180 seconds: investigate

A representative benchmark solved 607 legal Structures in 58.143 seconds wall-clock using the current exact solver path with eight solver processes.

## Separation rule

The production solver remains canonical in the private project. This public repository must not contain a copied or forked version of the production optimization engine.
