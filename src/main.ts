import "./styles.css";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) {
  throw new Error("App root is missing");
}

root.innerHTML = `
  <header class="app-header">
    <div>
      <div class="app-title">CS2 Trade-Up Solver</div>
      <div class="app-subtitle">Near-real-time exact basket search</div>
    </div>
    <div class="status-pill">Early access</div>
  </header>
  <main class="app-main">
    <section class="panel intro-panel">
      <h1>Exact baskets, not just recipes.</h1>
      <p>The public interface is being connected to the asynchronous solver API.</p>
    </section>
  </main>
`;
