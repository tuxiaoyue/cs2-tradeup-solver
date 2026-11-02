# CS2 Trade-Up Solver

A near-real-time CS2 trade-up solver focused on **exact, executable baskets**.

## What this project is

The first public version is intentionally narrow:

1. Select **one CS2 Collection** or **two distinct Collections**.
2. Enumerate every legal trade-up Structure inside that search space.
3. Solve each Structure with the existing private exact optimizer.
4. Return **one best exact basket per Structure** using the current hosted market snapshot.

For a two-Collection request, the search space includes legal pure-A, pure-B, and mixed A/B Structures. It does not admit a third Collection.

The goal is not to publish a theoretical recipe and leave the user to search for matching floats. The goal is to return the exact 10-listing input basket found by the solver for each successfully solved Structure.

## Public web experience

The v1 English web client supports:

- Single Collection and Two Collections modes
- server-controlled Collection IDs and display names
- asynchronous `QUEUED -> RUNNING -> COMPLETED / FAILED` jobs
- queue / progress state when supplied by the service
- a dense Structure result table
- exact 10-listing basket detail for OPTIMAL Structures
- visible INFEASIBLE / TIMEOUT / ERROR Structures
- visible negative economics and unavailable economics

There are no BUY/SELL labels or recommendation filters.

## What v1 is not

The first version does **not** provide:

- Top-K baskets per Structure
- Budget constraints
- ROI or EV filtering
- Buy / sell recommendations
- Risk scoring
- Automatic purchasing
- Cross-Structure capital allocation
- Three-or-more-Collection requests
- Multi-market optimization
- User-supplied marketplace credentials
- Accounts or payments

Results are calculations from a market snapshot, not a guarantee of profit or future listing availability.

## Performance evidence

A representative internal benchmark using two Collections and real retained listing data produced:

- 607 legal Structures
- 598 optimal solutions
- 9 infeasible Structures
- 0 timeouts
- 0 errors
- 58.143 seconds total wall-clock time

The initial service target is:

- **≤ 120 s:** ideal
- **120–180 s:** acceptable
- **> 180 s:** investigate before treating the request path as interactive

This benchmark is evidence for feasibility, not a latency guarantee for every Collection selection.

## Repository boundary

This repository is the **public interface layer**.

It contains the public web client, API contract, examples, documentation, tests, and CI. It does **not** contain the production solver, marketplace credentials, private trading logic, Daily pipeline, purchasing code, or production databases.

The intended boundary is:

```text
Public Web
    -> Public HTTPS API
    -> bounded queue / scheduler
    -> isolated private worker
    -> canonical private exact solver
```

Public work is designed to yield to private Daily / trading workloads. Initial service-level active solve concurrency is configurable and starts at `1`; this is a server policy, not a browser parameter.

## Local development

The repository can be developed without access to the private solver.

```bash
npm install --legacy-peer-deps
npm test
npm run build
npm run lint:openapi
npm run dev
```

By default the web client uses same-origin `/v1/...` API routes. To point a local build at a safe mock or development API, set `VITE_API_BASE_URL` locally. Never put marketplace credentials in the browser environment.

The JSON files under `examples/` are synthetic contract examples; they are not production market snapshots.

## API contract

The public contract is documented in [`openapi.yaml`](openapi.yaml).

Main endpoints:

- `GET /v1/collections`
- `GET /v1/service-status`
- `POST /v1/solve`
- `GET /v1/jobs/{job_id}`

The solve endpoint accepts only the narrow single/dual Collection request defined by the schema. It does not accept files, URLs, code, SQL-like expressions, filesystem paths, or marketplace keys.

## Status

Early development. The hosted API is not public yet.

The current milestone is the stable public boundary:

`1–2 Collections -> asynchronous job -> one exact best basket for every legal Structure`

## Security

Please read [SECURITY.md](SECURITY.md) before reporting a vulnerability.
