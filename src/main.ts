import "./styles.css";

import { PublicApiError, SolverApi } from "./api";
import { exactBasketDetail } from "./basket-detail";
import { collectionOptions, normalizeSelection } from "./catalog";
import { JobController } from "./job-controller";
import { buildSolveRequest } from "./request";
import { projectStructureRows } from "./results";
import { projectServiceStatus } from "./service-status";
import type { CollectionOption } from "./catalog";
import type { JobResponse, SolveMode, SolveResult, StructureResult } from "./types";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) {
  throw new Error("App root is missing");
}

const api = new SolverApi(import.meta.env.VITE_API_BASE_URL ?? "");
const jobs = new JobController(api);
let mode: SolveMode = "single";
let options: CollectionOption[] = [];
let solveEnabledByService = false;
let jobActive = false;
let currentResult: SolveResult | null = null;

root.innerHTML = `
  <header class="app-header">
    <div>
      <div class="app-title">CS2 Trade-Up Solver</div>
      <div class="app-subtitle">Near-real-time exact basket search</div>
    </div>
    <div id="service-pill" class="status-pill">Checking service…</div>
  </header>
  <main class="app-main">
    <section class="panel search-panel">
      <div class="search-heading">
        <div>
          <h1>Exact baskets, not just recipes.</h1>
          <p>Select one Collection or search the complete legal Structure space across two Collections.</p>
        </div>
        <div class="market-badge">C5 · v1</div>
      </div>

      <div class="mode-switch" role="group" aria-label="Collection mode">
        <button id="mode-single" class="mode-button active" type="button">Single Collection</button>
        <button id="mode-dual" class="mode-button" type="button">Two Collections</button>
      </div>

      <div id="service-banner" class="service-banner" hidden></div>

      <div class="selector-grid">
        <label>
          <span>Collection A</span>
          <select id="collection-a" aria-label="Collection A"></select>
        </label>
        <label id="collection-b-field" hidden>
          <span>Collection B</span>
          <select id="collection-b" aria-label="Collection B"></select>
        </label>
        <button id="solve-button" class="primary solve-button" type="button" disabled>Solve</button>
      </div>
      <div id="selection-message" class="selection-message">Loading Collection catalog…</div>
    </section>

    <section id="job-panel" class="panel job-panel" hidden></section>
    <section id="results-panel" class="panel results-panel" hidden></section>
  </main>
`;

const modeSingle = requiredButton("mode-single");
const modeDual = requiredButton("mode-dual");
const collectionA = requiredSelect("collection-a");
const collectionB = requiredSelect("collection-b");
const collectionBField = requiredElement("collection-b-field");
const solveButton = requiredButton("solve-button");
const servicePill = requiredElement("service-pill");
const serviceBanner = requiredElement("service-banner");
const selectionMessage = requiredElement("selection-message");
const jobPanel = requiredElement("job-panel");
const resultsPanel = requiredElement("results-panel");

modeSingle.addEventListener("click", () => setMode("single"));
modeDual.addEventListener("click", () => setMode("dual"));
collectionA.addEventListener("change", refreshSelectionState);
collectionB.addEventListener("change", refreshSelectionState);
solveButton.addEventListener("click", () => void submitSolve());

void loadInitialState();

async function loadInitialState(): Promise<void> {
  try {
    const [catalog, service] = await Promise.all([
      api.getCollections(),
      api.getServiceStatus()
    ]);
    options = collectionOptions(catalog.collections);
    renderCollectionOptions();

    const serviceView = projectServiceStatus(service);
    solveEnabledByService = serviceView.solveEnabled;
    servicePill.textContent = serviceView.message;
    servicePill.dataset.tone = serviceView.tone;
    serviceBanner.textContent = serviceView.message;
    serviceBanner.dataset.tone = serviceView.tone;
    serviceBanner.hidden = serviceView.tone === "ready";
    refreshSelectionState();
  } catch {
    solveEnabledByService = false;
    servicePill.textContent = "API unavailable";
    servicePill.dataset.tone = "unavailable";
    serviceBanner.textContent = "The public solver API is not connected yet.";
    serviceBanner.dataset.tone = "unavailable";
    serviceBanner.hidden = false;
    selectionMessage.textContent = "Collection catalog unavailable.";
    solveButton.disabled = true;
  }
}

async function submitSolve(): Promise<void> {
  if (jobActive) return;

  try {
    const request = buildSolveRequest(mode, collectionA.value, mode === "dual" ? collectionB.value : null);
    jobActive = true;
    currentResult = null;
    resultsPanel.hidden = true;
    jobPanel.hidden = false;
    jobPanel.innerHTML = `<div class="job-content"><strong>Submitting…</strong><span>Creating an asynchronous solve job.</span></div>`;
    refreshSelectionState();

    await jobs.start(request, renderJobState);
  } catch (error) {
    renderSubmissionError(error);
  } finally {
    jobActive = false;
    refreshSelectionState();
  }
}

function renderJobState(job: JobResponse): void {
  jobPanel.hidden = false;

  if (job.status === "QUEUED") {
    const queue = job.queue_position == null ? "Waiting for a solver slot" : `Queue position ${job.queue_position}`;
    jobPanel.innerHTML = jobMarkup("QUEUED", queue, "The request is queued and will start when public compute is available.");
    return;
  }

  if (job.status === "RUNNING") {
    const progress = job.progress
      ? `${job.progress.structures_completed} / ${job.progress.structures_total} Structures`
      : "Solving Structures";
    const elapsed = job.elapsed_seconds == null ? "" : ` · ${job.elapsed_seconds.toFixed(1)}s elapsed`;
    jobPanel.innerHTML = jobMarkup("RUNNING", `${progress}${elapsed}`, "Each Structure is solved independently using the exact solver path.");
    return;
  }

  if (job.status === "FAILED") {
    jobPanel.innerHTML = jobMarkup("FAILED", "The solve job did not complete.", "No purchase or publication action was taken.", "failed");
    return;
  }

  const solved = job.result?.structures.filter((structure) => structure.status === "OPTIMAL").length ?? 0;
  const total = job.result?.structures.length ?? 0;
  jobPanel.innerHTML = jobMarkup("COMPLETED", `${solved} solved / ${total} Structures`, "Select a Structure below to inspect its exact basket.", "completed");
  if (job.result) {
    renderResults(job.result);
  }
}

function renderResults(result: SolveResult): void {
  currentResult = result;
  const rows = projectStructureRows(result);
  const solved = rows.filter((row) => row.status === "OPTIMAL").length;

  resultsPanel.hidden = false;
  resultsPanel.innerHTML = `
    <div class="results-heading">
      <div>
        <strong>${solved} solved / ${rows.length} Structures</strong>
        <span>Market snapshot ${escapeHtml(formatTimestamp(result.market_snapshot_at))}</span>
      </div>
      <div class="result-meta">Solver ${escapeHtml(result.solver_version)} · Result ${escapeHtml(result.result_version)}</div>
    </div>
    <div class="result-table" role="table" aria-label="Structure results">
      <div class="result-head" role="row">
        <span>Structure</span><span>Status</span><span class="number">Cost</span><span class="number">EV</span><span class="number">Profit</span><span class="number">ROI</span>
      </div>
      <div class="result-body">
        ${rows.map((row) => `
          <button class="result-row" type="button" data-structure-id="${escapeHtml(row.structureId)}" role="row">
            <span class="structure-cell">${escapeHtml(row.label)}</span>
            <span><span class="structure-status" data-status="${escapeHtml(row.status)}">${escapeHtml(row.status)}</span></span>
            <span class="number">${formatCny(row.costCny)}</span>
            <span class="number">${formatCny(row.expectedValueCny)}</span>
            <span class="number ${signClass(row.expectedProfitCny)}">${formatCny(row.expectedProfitCny)}</span>
            <span class="number ${signClass(row.roi)}">${formatRoi(row.roi)}</span>
          </button>
        `).join("")}
      </div>
    </div>
    <div id="basket-detail" class="basket-detail empty-detail">
      Select a Structure to inspect solver status and exact inputs.
    </div>
  `;

  resultsPanel.querySelectorAll<HTMLButtonElement>(".result-row").forEach((button) => {
    button.addEventListener("click", () => renderStructureDetail(button.dataset.structureId ?? ""));
  });
}

function renderStructureDetail(structureId: string): void {
  const result = currentResult;
  const detailPanel = document.getElementById("basket-detail");
  if (!result || !detailPanel) return;

  const structure = result.structures.find((candidate) => candidate.structure_id === structureId);
  if (!structure) return;

  resultsPanel.querySelectorAll(".result-row").forEach((row) => {
    row.classList.toggle("selected", row instanceof HTMLElement && row.dataset.structureId === structureId);
  });

  if (structure.status !== "OPTIMAL") {
    detailPanel.className = "basket-detail";
    detailPanel.innerHTML = `
      <div class="detail-heading">
        <div><strong>${escapeHtml(structure.structure_label)}</strong><span>${escapeHtml(structure.status)}</span></div>
      </div>
      <div class="status-detail">${escapeHtml(structure.reason || statusExplanation(structure))}</div>
    `;
    return;
  }

  try {
    const detail = exactBasketDetail(structure);
    if (!detail) return;
    detailPanel.className = "basket-detail";
    detailPanel.innerHTML = `
      <div class="detail-heading">
        <div>
          <strong>${escapeHtml(detail.label)}</strong>
          <span>10 exact C5 listings · ${detail.runtimeSeconds == null ? "runtime unavailable" : `${detail.runtimeSeconds.toFixed(3)}s solver runtime`}</span>
        </div>
        <div class="detail-economics">
          <span>Cost <strong>${formatCny(detail.economics.cost_cny)}</strong></span>
          <span>EV <strong>${formatCny(detail.economics.expected_value_cny)}</strong></span>
          <span>Profit <strong class="${signClass(detail.economics.expected_profit_cny)}">${formatCny(detail.economics.expected_profit_cny)}</strong></span>
          <span>ROI <strong class="${signClass(detail.economics.roi)}">${formatRoi(detail.economics.roi)}</strong></span>
        </div>
      </div>
      <div class="basket-table">
        <div class="basket-head"><span>Item</span><span>Collection</span><span>Wear</span><span class="number">Float</span><span class="number">C5 price</span><span>Listing ID</span></div>
        ${detail.inputs.map((input) => `
          <div class="basket-row">
            <span class="item-name">${escapeHtml(input.market_hash_name)}</span>
            <span>${escapeHtml(input.collection_name)}</span>
            <span>${escapeHtml(input.wear)}</span>
            <span class="number mono">${input.float_value.toFixed(6)}</span>
            <span class="number">${formatCny(input.price_cny)}</span>
            <span class="mono listing-id">${escapeHtml(input.listing_id)}</span>
          </div>
        `).join("")}
      </div>
      <div class="snapshot-note">Snapshot: ${escapeHtml(formatTimestamp(result.market_snapshot_at))}. Listings may change after the snapshot.</div>
    `;
  } catch {
    detailPanel.className = "basket-detail integrity-error";
    detailPanel.textContent = "Result integrity check failed: an OPTIMAL basket must contain exactly 10 exact inputs.";
  }
}

function renderSubmissionError(error: unknown): void {
  jobPanel.hidden = false;
  let message = "The request could not be submitted.";

  if (error instanceof PublicApiError) {
    if (error.status === 409) message = "The solver is in its Daily priority / maintenance window.";
    else if (error.status === 429) message = "The public solve queue is currently full. Try again later.";
    else if (error.status === 503) message = "Public solving is temporarily unavailable.";
    else if (error.status === 400) message = "The selected Collection request is not valid.";
  }

  jobPanel.innerHTML = jobMarkup("NOT SUBMITTED", message, "No solver job was started.", "failed");
}

function jobMarkup(status: string, primary: string, detail: string, tone = ""): string {
  return `
    <div class="job-content ${tone}">
      <span class="job-status">${escapeHtml(status)}</span>
      <strong>${escapeHtml(primary)}</strong>
      <span>${escapeHtml(detail)}</span>
    </div>
  `;
}

function statusExplanation(structure: StructureResult): string {
  if (structure.status === "INFEASIBLE") return "No legal exact basket was found for this Structure in the market snapshot.";
  if (structure.status === "TIMEOUT") return "The Structure did not reach an exact optimal result within the solver time limit.";
  return "This Structure could not be solved for the current request.";
}

function setMode(nextMode: SolveMode): void {
  if (jobActive) return;
  mode = nextMode;
  const normalized = normalizeSelection(mode, collectionA.value, collectionB.value);
  if (mode === "single") {
    collectionB.value = normalized.collectionB ?? "";
  }
  collectionBField.hidden = mode === "single";
  modeSingle.classList.toggle("active", mode === "single");
  modeDual.classList.toggle("active", mode === "dual");
  refreshSelectionState();
}

function renderCollectionOptions(): void {
  const markup = [
    `<option value="">Select a Collection</option>`,
    ...options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
  ].join("");
  collectionA.innerHTML = markup;
  collectionB.innerHTML = markup;
  selectionMessage.textContent = `${options.length} Collections available`;
}

function refreshSelectionState(): void {
  let selectionValid = Boolean(collectionA.value);
  let message = selectionValid ? "Ready to solve." : "Choose Collection A.";

  if (mode === "dual") {
    if (!collectionB.value) {
      selectionValid = false;
      message = "Choose Collection B.";
    } else if (collectionA.value === collectionB.value) {
      selectionValid = false;
      message = "Two Collection mode requires different Collections.";
    }
  }

  modeSingle.disabled = jobActive;
  modeDual.disabled = jobActive;
  collectionA.disabled = jobActive;
  collectionB.disabled = jobActive;
  solveButton.disabled = jobActive || !(solveEnabledByService && selectionValid);
  selectionMessage.textContent = jobActive ? "Solve job in progress." : message;
}

function requiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element;
}

function requiredButton(id: string): HTMLButtonElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLButtonElement)) throw new Error(`Missing button: ${id}`);
  return element;
}

function requiredSelect(id: string): HTMLSelectElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLSelectElement)) throw new Error(`Missing select: ${id}`);
  return element;
}

function formatCny(value: number | null): string {
  if (value == null) return "—";
  const sign = value < 0 ? "−" : "";
  return `${sign}¥${Math.abs(value).toFixed(2)}`;
}

function formatRoi(value: number | null): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

function signClass(value: number | null): string {
  if (value == null || value === 0) return "";
  return value > 0 ? "positive" : "negative";
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
