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

## Implementation Alignment

The public contract is intentionally ahead of the current private service implementation. Future service integration must address:

1. SINGLE requests explicitly carry `collection_b: null`; the current service permits omission.
2. HTTP 429 must distinguish `QUEUE_FULL` from `RATE_LIMITED`; the current service maps both to `QUEUE_FULL`.
3. HTTP 413 must return a JSON ErrorEnvelope; the current content-length rejection can return an empty response.
4. Job failures use the public `JobFailureObject`; internal `SERVICE_RESTARTED` maps to public `SOLVE_FAILED`.
5. An uninitialized catalog returns 503 from `GET /v1/collections`, rather than an empty version.
6. Service status reflects catalog readiness and never reports accepting jobs while catalog data is unavailable.
7. `progress` and `elapsed_seconds` remain null until implemented.
8. Economics must be independently validated as all numeric or all null at the gateway boundary.
9. Gateway validation must enforce request/result Collection mode, basket/count, and Structure constraints.
