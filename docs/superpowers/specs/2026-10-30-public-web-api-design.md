# Public Web + API v1 Design

## Intent

Build the first public-facing version of the CS2 Trade-Up Solver as a thin, safe interface around the existing private exact solver. The product should let a user choose either one Collection or two Collections, submit a solve request, wait for an asynchronous job, and inspect the best exact basket found for every legal Structure in that search space.

The public product is a calculation service, not a recommendation service. It reports solver results and market-snapshot economics without telling the user what to buy.

## Goals

- Public English web UI.
- User chooses **Single Collection** or **Two Collections**.
- Single mode accepts one server-known Collection ID.
- Dual mode accepts two server-known Collection IDs.
- Enumerate all legal Structures for the selected search space.
- Reuse the existing private exact solver unchanged.
- Return one best exact basket per Structure.
- Preserve OPTIMAL / INFEASIBLE / TIMEOUT / ERROR states.
- Use the hosted C5 market path for v1.
- Asynchronous jobs with queueing.
- Concurrency is configurable from day one; initial active solve concurrency is **1**.
- Public jobs yield to Daily / private trading workloads.
- Reserve approximately **4 hours/day** for maintenance and Daily priority.
- Keep the public web/API boundary isolated from purchasing, publication, credentials, and production DB writes.

## Non-goals

- Top-K baskets per Structure.
- Budget, ROI, EV, or risk constraints.
- Recommendations or BUY/SELL labels.
- Automatic purchasing.
- Cross-Structure capital allocation.
- Three-or-more-Collection requests.
- User-supplied marketplace API keys.
- Multi-market optimization.
- Accounts, subscriptions, or payments in v1.
- Public release of the private solver implementation.

## Chosen approach

### A — Public web frontend + independent public API + private solver worker

This is the selected architecture.

```text
Browser
  |
  v
Public English Web App
  |
  v
HTTPS API Gateway
  |
  v
Durable Job Queue
  |   MAX_ACTIVE_SOLVES = 1 initially
  v
Isolated Solver Worker
  |
  v
Canonical Private Exact Solver
  |
  v
Read-only market snapshot / C5 data path
```

The frontend and public API contract can be open source. The private solver, C5 credentials, Daily pipeline, purchasing logic, publication logic, and production database remain private.

### Rejected alternatives

**Combined web + solver process:** simpler initially, but creates an unnecessary trust and failure boundary between untrusted internet input and the production solver environment.

**Copy solver code into the public project:** rejected because it would create two solver versions, expose proprietary implementation details, and increase drift risk.

## Web experience

### Search screen

The first screen is deliberately small and uses the visual language of the existing purchase WebView: light gray application background, white panels, restrained blue primary action, compact data-oriented layout.

```text
CS2 Trade-Up Solver
Near-real-time exact basket search

[ Single Collection ] [ Two Collections ]

Collection A   [ Select collection                 v ]
Collection B   [ Select collection                 v ]  <- dual mode only

                         [ Solve ]
```

Collection selection is from a server-provided allowlist/catalog. The browser never sends arbitrary collection names as executable or query expressions.

### Job state

Submitting creates an asynchronous job.

```text
QUEUED -> RUNNING -> COMPLETED
                  -> FAILED
```

During the Daily/maintenance window, new jobs may be accepted into the queue but not started, or the service may temporarily reject new jobs with a clear maintenance status. Running jobs should normally be allowed to finish rather than being killed for maintenance.

The UI should show:

- job status;
- queue position when available;
- elapsed time;
- structures completed / total when available;
- maintenance state when applicable.

### Results screen

The results screen follows the existing purchase UI pattern: dense Structure table first, exact basket detail on selection.

```text
598 solved / 607 Structures
Market snapshot: <timestamp>

Structure                  Status      Cost       EV         Profit      ROI
8 A + 2 B                  OPTIMAL     ...        ...        ...         ...
7 A + 3 B                  OPTIMAL     ...        ...        ...         ...
...                         INFEASIBLE  -          -          -           -
```

No positive/negative EV filtering is applied. Negative results remain visible. No recommendation label is added.

Selecting one Structure opens its single best exact basket:

- 10 exact input listings;
- item / skin identity;
- Collection;
- wear / float;
- C5 price;
- listing identifier if safe to expose;
- total basket cost;
- output expected value when available;
- expected profit and ROI when available;
- solver status;
- market snapshot timestamp;
- solver version / result version metadata.

If output valuation is unavailable, the Structure result remains visible with valuation fields marked unavailable rather than silently removed.

## API contract

### Public read endpoints

`GET /v1/collections`

Returns the server-maintained Collection catalog used by the UI. IDs are opaque server-controlled identifiers; display names are presentation data.

`GET /v1/service-status`

Returns availability, maintenance state, queue availability, and coarse service status. It must not expose host details, process details, credentials, file paths, or internal network information.

### Submit solve

`POST /v1/solve`

Accepted request shape is intentionally narrow:

```json
{
  "mode": "single" | "dual",
  "collection_a": "server-controlled-id",
  "collection_b": "server-controlled-id-or-null"
}
```

Validation rules:

- `mode=single` requires exactly one Collection.
- `mode=dual` requires exactly two distinct Collection IDs.
- Collection IDs must exist in the current server catalog.
- Unknown fields are rejected.
- No URLs, files, paths, SQL-like expressions, free-form filters, code, or arbitrary payloads are accepted.

Successful submission returns `202 Accepted` with a server-generated opaque `job_id`.

### Job status/result

`GET /v1/jobs/{job_id}`

Returns job lifecycle state and, after completion, result metadata. Job IDs are server-generated and validated as opaque identifiers; they are never used as filesystem paths.

The API should not keep the original `POST /solve` HTTP connection open for the full solver duration.

## Queue and concurrency

Concurrency is configuration-driven from the beginning.

Initial values:

```text
MAX_ACTIVE_SOLVES = 1
MAX_QUEUED_SOLVES = small bounded value
```

The exact queue cap is an operational configuration, not a user parameter.

The scheduler must support future values greater than 1 without changing the public API contract.

Public solving has lower priority than Daily / private trading workloads. A maintenance gate prevents new queued public jobs from starting during the reserved window. This is a scheduler policy, not a solver modification.

## Security boundary

### Internet-facing layer

The public API must be treated as hostile-input territory.

Requirements:

- HTTPS only.
- Prefer an outbound tunnel / managed edge rather than exposing the home Windows host by router port-forwarding.
- Strict typed schema validation.
- Small request-body limit.
- Rate limiting before expensive work begins.
- Bounded queue length.
- No file upload in v1.
- No URL fetch supplied by users.
- No arbitrary filters or expressions.
- Generic external errors; internal stack traces stay private.

### Gateway authority

The gateway must not have:

- C5 purchase credentials;
- purchasing authority;
- Daily publication authority;
- production DB write authority;
- shell command execution derived from user input;
- permission to modify the private solver repository.

### Solver worker authority

The worker receives only validated internal job objects. It may access only the minimum market snapshot / data and solver interfaces required to compute results.

The worker must not expose a public listener directly to the internet.

### Secrets and logs

- C5 credentials never enter the public repository or browser.
- Secrets are not included in request/result logs.
- Logs record job ID, selected Collection IDs, timestamps, solver version, status, timing, and coarse failure category.
- User input never becomes a path, command, module name, SQL fragment, or URL.

## Runtime isolation

For v1, the service may run on the existing hardware, but public work is isolated by process, permissions, queue, and scheduler policy.

The canonical private solver remains the only solver implementation.

Public requests must not invoke the full Daily pipeline. They call only the narrow on-demand path necessary to:

1. resolve one or two Collections;
2. enumerate legal Structures;
3. prepare the shared candidate/listing universe;
4. solve each Structure with the existing exact path;
5. serialize safe result data.

## Performance target

Representative benchmark evidence:

- 607 legal Structures;
- 598 OPTIMAL;
- 9 INFEASIBLE;
- 0 timeout;
- 0 error;
- 58.143 seconds total wall-clock;
- eight solver processes;
- solve p50 0.532 s;
- solve p90 1.219 s;
- solve max 6.654 s.

Operating envelope:

- <=120 s: ideal;
- 120-180 s: acceptable;
- >180 s: investigate before calling the path interactive.

This is not a latency guarantee for every Collection selection.

## Failure behavior

- Invalid Collection request: reject before queueing.
- Queue full: reject without invoking the solver.
- Maintenance gate active: either queue without starting or return explicit maintenance state according to deployment policy.
- Worker timeout/failure: mark the job failed; never retry indefinitely.
- Individual Structure INFEASIBLE/TIMEOUT/ERROR: preserve that Structure state in the completed job if the overall run can complete safely.
- Missing output valuation: preserve the solved basket and mark economics unavailable.
- Gateway/worker restart: queued/running job state should fail safely rather than silently claiming completion.

## Public/private repository split

### Public repository: `cs2-tradeup-solver`

May contain:

- web frontend;
- public API specification;
- public client code;
- examples;
- documentation;
- safe mock/sample responses;
- security reporting policy.

Must not contain:

- solver implementation copied from the private project;
- C5 secrets;
- production DBs or snapshots containing sensitive/private data;
- purchasing code;
- Daily publication internals.

### Private service/solver side

Owns:

- authenticated C5 access;
- market snapshot acquisition;
- canonical exact solver invocation;
- scheduler / maintenance integration;
- private result serialization boundary;
- internal operational logging.

## Deferred decisions

These are intentionally postponed until the free MVP has real usage:

- authentication/account model;
- payment/credits;
- cache policy for repeated Collection requests;
- dedicated compute server;
- multi-worker production concurrency above 1;
- BYO marketplace/local agent;
- multi-market pricing;
- affiliate/deep-link behavior;
- advanced result sharing.

## Success criteria for v1

A stranger can open the English website, choose one or two Collections, submit a job, wait through queue/solve state, and inspect every legal Structure plus its single best exact basket without gaining any path to the private solver host, credentials, purchasing system, Daily publication system, or production DB writes.
