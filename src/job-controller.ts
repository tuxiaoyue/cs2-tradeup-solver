import type {
  JobResponse,
  SolveAcceptedResponse,
  SolveRequest
} from "./types";

export interface JobApi {
  submitSolve(request: SolveRequest): Promise<SolveAcceptedResponse>;
  getJob(jobId: string): Promise<JobResponse>;
}

export type JobStateListener = (job: JobResponse) => void;

export class JobController {
  private readonly api: JobApi;
  private readonly pollIntervalMs: number;
  private runToken = 0;
  private jobId: string | null = null;

  constructor(api: JobApi, pollIntervalMs = 1500) {
    if (!Number.isFinite(pollIntervalMs) || pollIntervalMs < 0) {
      throw new Error("pollIntervalMs must be a non-negative finite number");
    }
    this.api = api;
    this.pollIntervalMs = pollIntervalMs;
  }

  get currentJobId(): string | null {
    return this.jobId;
  }

  async start(request: SolveRequest, onState: JobStateListener): Promise<void> {
    const token = ++this.runToken;
    const accepted = await this.api.submitSolve(request);
    if (token !== this.runToken) return;

    this.jobId = accepted.job_id;

    while (token === this.runToken) {
      const state = await this.api.getJob(accepted.job_id);
      if (token !== this.runToken) return;

      onState(state);
      if (state.status === "COMPLETED" || state.status === "FAILED") {
        return;
      }

      if (this.pollIntervalMs > 0) {
        await delay(this.pollIntervalMs);
      }
    }
  }

  stop(): void {
    this.runToken += 1;
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}
