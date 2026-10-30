import "./styles.css";

import { SolverApi } from "./api";
import { collectionOptions, normalizeSelection } from "./catalog";
import { projectServiceStatus } from "./service-status";
import type { CollectionOption } from "./catalog";
import type { SolveMode } from "./types";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) {
  throw new Error("App root is missing");
}

const api = new SolverApi(import.meta.env.VITE_API_BASE_URL ?? "");
let mode: SolveMode = "single";
let options: CollectionOption[] = [];
let solveEnabledByService = false;

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

modeSingle.addEventListener("click", () => setMode("single"));
modeDual.addEventListener("click", () => setMode("dual"));
collectionA.addEventListener("change", refreshSelectionState);
collectionB.addEventListener("change", refreshSelectionState);

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

function setMode(nextMode: SolveMode): void {
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

  solveButton.disabled = !(solveEnabledByService && selectionValid);
  selectionMessage.textContent = message;
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
