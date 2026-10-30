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

export class JobPollingError extends Error {
  readonly jobId: string;
  readonly cause: unknown;

  constructor(jobId: string, cause: unknown) {
    super("Job status could not be refreshed");
    this.name = "JobPollingError";
    this.jobId = jobId;
    this.cause = cause;
  }
}

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
    this.jobId = null;

    const accepted = await this.api.submitSolve(request);
    if (token !== this.runToken) return;

    this.jobId = accepted.job_id;

    while (token === this.runToken) {
      let state: JobResponse;
      try {
        state = await this.api.getJob(accepted.job_id);
      } catch (cause) {
        if (token !== this.runToken) return;
        throw new JobPollingError(accepted.job_id, cause);
      }
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
