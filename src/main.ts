import "./styles.css";

import { PublicApiError, SolverApi } from "./api";
import { collectionOptions, normalizeSelection } from "./catalog";
import { JobController } from "./job-controller";
import { buildSolveRequest } from "./request";
import { projectServiceStatus } from "./service-status";
import type { CollectionOption } from "./catalog";
import type { JobResponse, SolveMode } from "./types";

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
    resultsPanel.hidden = false;
    resultsPanel.innerHTML = `<div class="results-placeholder">Result table ready for rendering · ${escapeHtml(job.result.market_snapshot_at)}</div>`;
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
