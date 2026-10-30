import { describe, expect, it, vi } from "vitest";

import { JobController } from "../src/job-controller";
import { PublicApiError } from "../src/api";
import type { JobResponse, SolveAcceptedResponse, SolveRequest } from "../src/types";

const request: SolveRequest = {
  mode: "single",
  collection_a: "collection-a",
  collection_b: null
};

function job(status: JobResponse["status"], overrides: Partial<JobResponse> = {}): JobResponse {
  return {
    job_id: "job_abcdefghijklmnop",
    status,
    submitted_at: "2026-10-30T12:00:00Z",
    started_at: status === "QUEUED" ? null : "2026-10-30T12:00:01Z",
    completed_at: status === "COMPLETED" || status === "FAILED" ? "2026-10-30T12:00:05Z" : null,
    queue_position: status === "QUEUED" ? 2 : null,
    progress: status === "RUNNING" ? { structures_completed: 12, structures_total: 100 } : null,
    elapsed_seconds: status === "RUNNING" ? 4 : null,
    result: null,
    error: status === "FAILED" ? { code: "SOLVE_FAILED", message: "Solve failed" } : null,
    ...overrides
  };
}

describe("JobController", () => {
  it("stores only the opaque job id returned by submit", async () => {
    const accepted: SolveAcceptedResponse = {
      job_id: "job_abcdefghijklmnop",
      status: "QUEUED",
      submitted_at: "2026-10-30T12:00:00Z",
      queue_position: 2
    };
    const api = {
      submitSolve: vi.fn().mockResolvedValue(accepted),
      getJob: vi.fn().mockResolvedValue(job("COMPLETED"))
    };
    const controller = new JobController(api, 1000);

    await controller.start(request, () => undefined);

    expect(controller.currentJobId).toBe("job_abcdefghijklmnop");
    expect(api.getJob).toHaveBeenCalledWith("job_abcdefghijklmnop");
  });

  it("emits queued and running state including queue/progress fields", async () => {
    const api = {
      submitSolve: vi.fn().mockResolvedValue({
        job_id: "job_abcdefghijklmnop", status: "QUEUED", submitted_at: "2026-10-30T12:00:00Z"
      }),
      getJob: vi.fn()
        .mockResolvedValueOnce(job("QUEUED"))
        .mockResolvedValueOnce(job("RUNNING"))
        .mockResolvedValueOnce(job("COMPLETED"))
    };
    const states: JobResponse[] = [];
    const controller = new JobController(api, 0);

    await controller.start(request, (state) => states.push(state));

    expect(states[0].queue_position).toBe(2);
    expect(states[1].progress).toEqual({ structures_completed: 12, structures_total: 100 });
  });

  it("stops polling after completed", async () => {
    const api = {
      submitSolve: vi.fn().mockResolvedValue({
        job_id: "job_abcdefghijklmnop", status: "QUEUED", submitted_at: "2026-10-30T12:00:00Z"
      }),
      getJob: vi.fn().mockResolvedValue(job("COMPLETED"))
    };
    const controller = new JobController(api, 0);

    await controller.start(request, () => undefined);

    expect(api.getJob).toHaveBeenCalledTimes(1);
  });

  it("stops polling after failed and emits the failed job", async () => {
    const api = {
      submitSolve: vi.fn().mockResolvedValue({
        job_id: "job_abcdefghijklmnop", status: "QUEUED", submitted_at: "2026-10-30T12:00:00Z"
      }),
      getJob: vi.fn().mockResolvedValue(job("FAILED"))
    };
    const states: JobResponse[] = [];
    const controller = new JobController(api, 0);

    await controller.start(request, (state) => states.push(state));

    expect(states.at(-1)?.status).toBe("FAILED");
    expect(api.getJob).toHaveBeenCalledTimes(1);
  });

  it("does not poll when submission is rejected for maintenance or queue pressure", async () => {
    for (const status of [409, 429]) {
      const api = {
        submitSolve: vi.fn().mockRejectedValue(new PublicApiError(status, "NOT_ACCEPTING", "Not accepting jobs")),
        getJob: vi.fn()
      };
      const controller = new JobController(api, 0);

      await expect(controller.start(request, () => undefined)).rejects.toBeInstanceOf(PublicApiError);
      expect(api.getJob).not.toHaveBeenCalled();
    }
  });
});
