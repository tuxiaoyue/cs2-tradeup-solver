# Public Web Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public English website and public API contract for the near-real-time CS2 Trade-Up Solver without including any private solver or marketplace credentials.

**Architecture:** Use a static Vite + vanilla TypeScript frontend that talks only to the documented public API. The UI supports single-Collection and dual-Collection requests, async job polling, a dense Structure result table, and exact-basket detail. The private solver remains outside this repository.

**Tech Stack:** Vite, vanilla TypeScript, CSS, OpenAPI 3.1, Vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-10-30-public-web-api-design.md`

## Global Constraints

- English UI for v1.
- Single mode accepts exactly one server-provided Collection ID.
- Dual mode accepts exactly two distinct server-provided Collection IDs.
- Do not add Top-K, budget, ROI/EV filters, recommendations, auto-buy, accounts, payments, BYO API keys, multi-market routing, or 3+ Collection requests.
- Public repository must not contain private solver code, C5 credentials, production DB data, purchase code, or Daily publication internals.
- API is asynchronous: submit returns `202` + opaque `job_id`; browser polls job status/result.
- No arbitrary file, URL, SQL-like, path, expression, or free-form solver inputs.
- Negative economics and unavailable economics remain visible; no recommendation labels.
- Concurrency and queueing are server concerns; frontend displays only coarse service/job state.

## Review Focus

- Single/dual mode mismatch must never produce an invalid request body.
- Dual mode must reject selecting the same Collection twice.
- Maintenance/queue-full/service-unavailable responses must be visible and must not masquerade as solver failures.
- INFEASIBLE/TIMEOUT/ERROR Structures and negative ROI rows must remain visible.
- Missing economics must render as unavailable rather than zero or disappear.

---

### Task 1: Normalize public scope and define the API contract

**Files:**
- Modify: `docs/MVP_SCOPE.md`
- Create: `openapi.yaml`
- Create: `examples/collections.json`
- Create: `examples/job-completed.json`
- Create: `examples/job-running.json`

**Interfaces:**
- Consumes: approved design in the spec.
- Produces: stable public JSON shapes used by the frontend and future server.

- [ ] **Step 1: Update `docs/MVP_SCOPE.md`**

Change the contract from “exactly two Collections” to “one or two Collections”; preserve all other locked MVP restrictions.

- [ ] **Step 2: Add `openapi.yaml`**

Define exactly these public endpoints and schemas:

- `GET /v1/collections`
- `GET /v1/service-status`
- `POST /v1/solve`
- `GET /v1/jobs/{job_id}`

`POST /v1/solve` request fields are only `mode`, `collection_a`, `collection_b`; unknown fields are disallowed by schema. Job states are `QUEUED | RUNNING | COMPLETED | FAILED`.

- [ ] **Step 3: Add safe sample responses**

Samples must use invented IDs/listing data only. `job-completed.json` must contain at least one OPTIMAL row, one INFEASIBLE row, one negative-ROI row, and one OPTIMAL row with unavailable economics.

- [ ] **Step 4: Validate the OpenAPI document**

Run an OpenAPI validator locally (for example `npx @redocly/cli lint openapi.yaml`).
Expected: no schema errors.

- [ ] **Step 5: Commit**

```bash
git add docs/MVP_SCOPE.md openapi.yaml examples/
git commit -m "docs: define public solver API contract"
```

### Task 2: Scaffold the typed static frontend and request model

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/types.ts`
- Create: `src/api.ts`
- Create: `src/request.ts`
- Create: `src/main.ts`
- Create: `src/styles.css`
- Create: `tests/request.test.ts`

**Interfaces:**
- Consumes: Task 1 OpenAPI field names and enums.
- Produces: `SolverApi`, `buildSolveRequest(...)`, and the page bootstrap.

- [ ] **Step 1: Write failing request-shape tests in `tests/request.test.ts`**

Tests must assert:
- single mode serializes `collection_b: null`;
- dual mode requires two distinct IDs;
- duplicate dual Collections throw a client-side validation error;
- missing Collection A is rejected.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm test -- request.test.ts`
Expected: FAIL because request builder does not exist.

- [ ] **Step 3: Implement typed API models in `src/types.ts` and `src/request.ts`**

Required public interface:

```ts
export type SolveMode = "single" | "dual";
export function buildSolveRequest(mode: SolveMode, collectionA: string, collectionB?: string | null): SolveRequest;
```

- [ ] **Step 4: Implement `SolverApi` in `src/api.ts`**

Required methods:

```ts
getCollections(): Promise<CollectionCatalogResponse>
getServiceStatus(): Promise<ServiceStatusResponse>
submitSolve(request: SolveRequest): Promise<SolveAcceptedResponse>
getJob(jobId: string): Promise<JobResponse>
```

API base URL comes from `VITE_API_BASE_URL`; no credentials or marketplace keys are embedded in the client.

- [ ] **Step 5: Add minimal page scaffold and purchase-WebView-inspired CSS**

Use light gray app background, white panels, restrained blue primary action, compact typography, and data-first layout. Do not copy private JS behavior or private solver logic.

- [ ] **Step 6: Run tests and build**

Run: `npm test && npm run build`
Expected: PASS and Vite production build succeeds.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vite.config.ts index.html src/ tests/
git commit -m "feat: scaffold public solver web client"
```

### Task 3: Implement Collection selection and service-state UX

**Files:**
- Modify: `src/main.ts`
- Create: `src/catalog.ts`
- Create: `src/service-status.ts`
- Modify: `src/styles.css`
- Create: `tests/catalog.test.ts`
- Create: `tests/service-status.test.ts`

**Interfaces:**
- Consumes: `SolverApi.getCollections()` and `SolverApi.getServiceStatus()`.
- Produces: selectable server-controlled Collection catalog and maintenance/service banner state.

- [ ] **Step 1: Write failing tests**

Cover:
- switching to single mode hides/clears Collection B;
- dual mode prevents same-ID selection;
- catalog display names never become request IDs;
- maintenance and unavailable states disable Solve and show a clear banner.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- catalog.test.ts service-status.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement catalog and service-state functions**

Keep Collection IDs opaque and use display names only for presentation.

- [ ] **Step 4: Wire the search screen**

The visible controls are only mode, Collection A, optional Collection B, and Solve.

- [ ] **Step 5: Run tests and build**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ tests/
git commit -m "feat: add collection selection and service status"
```

### Task 4: Implement async job submission and polling

**Files:**
- Create: `src/job-controller.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Create: `tests/job-controller.test.ts`

**Interfaces:**
- Consumes: `SolverApi.submitSolve()` and `SolverApi.getJob()`.
- Produces: one active browser-side job lifecycle with `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED` rendering.

- [ ] **Step 1: Write failing lifecycle tests**

Assert:
- submit stores returned opaque `job_id` only;
- QUEUED shows queue position when present;
- RUNNING shows elapsed/progress when present;
- COMPLETED stops polling;
- FAILED stops polling and shows generic external failure text;
- maintenance/queue-full submit errors do not start polling.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- job-controller.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `JobController`**

Polling interval is a constant in the client; no long-held solve request connection.

- [ ] **Step 4: Wire job state into the page**

Do not expose internal host/process/file-path error details even if an unexpected response contains them.

- [ ] **Step 5: Run tests and build**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ tests/
git commit -m "feat: add async solve job lifecycle"
```

### Task 5: Implement Structure results and exact-basket detail

**Files:**
- Create: `src/results.ts`
- Create: `src/basket-detail.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Create: `tests/results.test.ts`

**Interfaces:**
- Consumes: completed `JobResponse` from Task 4.
- Produces: dense Structure table and one selected Structure’s exact 10-input basket detail.

- [ ] **Step 1: Write failing rendering-model tests**

Assert:
- all Structure states remain in the result model;
- negative ROI/profit values remain visible;
- missing economics map to `null`/unavailable presentation, never zero;
- INFEASIBLE/TIMEOUT/ERROR rows remain selectable for status detail but have no fake basket;
- an OPTIMAL basket with exact inputs requires exactly 10 input rows before rendering basket detail.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- results.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement result projection functions**

Required columns: Structure, Status, Cost, EV, Profit, ROI. Basket detail includes item identity, Collection, wear, float, C5 price, safe listing identifier, snapshot timestamp, solver/result version metadata.

- [ ] **Step 4: Implement table/detail UI using the purchase WebView visual language**

No BUY/SELL/recommendation styling. Positive and negative values may use neutral semantic formatting, but must not hide either side.

- [ ] **Step 5: Run full tests and build**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ tests/
git commit -m "feat: render structure results and exact baskets"
```

### Task 6: Public repo hardening and documentation

**Files:**
- Modify: `README.md`
- Modify: `SECURITY.md`
- Modify: `.gitignore`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: repeatable public CI and accurate public usage/security documentation.

- [ ] **Step 1: Add CI**

CI runs dependency install, unit tests, TypeScript/build checks, and OpenAPI lint.

- [ ] **Step 2: Update README**

Document local web development with a mock/sample API only; clearly state that the hosted production API is separate and private solver code is not present.

- [ ] **Step 3: Update SECURITY.md**

Explicitly state that users must never submit credentials or API keys and that v1 has no file-upload/BYO-key path.

- [ ] **Step 4: Run final verification**

Run: `npm test && npm run build` plus OpenAPI lint.
Expected: all PASS.

- [ ] **Step 5: Inspect repository for accidental secrets/private artifacts**

Run a repository-wide search for `.env`, `secret`, `api_key`, `client_secret`, database paths, and private solver module names. Expected: only documentation examples that contain no real values.

- [ ] **Step 6: Commit**

```bash
git add README.md SECURITY.md .gitignore .github/
git commit -m "chore: harden public web client repository"
```
