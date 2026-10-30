import { describe, expect, it, vi } from "vitest";

import { JobController, JobPollingError } from "../src/job-controller";
import { PublicApiError } from "../src/api";
import type { SolveRequest } from "../src/types";

const request: SolveRequest = {
  mode: "single",
  collection_a: "collection-a",
  collection_b: null
};

describe("JobController failure boundary", () => {
  it("distinguishes a polling failure after the job was accepted", async () => {
    const api = {
      submitSolve: vi.fn().mockResolvedValue({
        job_id: "job_abcdefghijklmnop",
        status: "QUEUED",
        submitted_at: "2026-10-30T12:00:00Z"
      }),
      getJob: vi.fn().mockRejectedValue(new TypeError("network unavailable"))
    };
    const controller = new JobController(api, 0);

    await expect(controller.start(request, () => undefined)).rejects.toEqual(
      expect.objectContaining({
        name: "JobPollingError",
        jobId: "job_abcdefghijklmnop"
      })
    );
    expect(controller.currentJobId).toBe("job_abcdefghijklmnop");
    expect(JobPollingError).toBeDefined();
  });

  it("clears a previous job id before a new submission attempt", async () => {
    const api = {
      submitSolve: vi.fn()
        .mockResolvedValueOnce({
          job_id: "job_first_abcdefghijk",
          status: "QUEUED",
          submitted_at: "2026-10-30T12:00:00Z"
        })
        .mockRejectedValueOnce(new PublicApiError(429, "QUEUE_FULL", "Queue full")),
      getJob: vi.fn().mockResolvedValue({
        job_id: "job_first_abcdefghijk",
        status: "COMPLETED",
        submitted_at: "2026-10-30T12:00:00Z",
        started_at: "2026-10-30T12:00:01Z",
        completed_at: "2026-10-30T12:00:02Z",
        queue_position: null,
        progress: null,
        elapsed_seconds: 1,
        result: null,
        error: null
      })
    };
    const controller = new JobController(api, 0);

    await controller.start(request, () => undefined);
    expect(controller.currentJobId).toBe("job_first_abcdefghijk");

    await expect(controller.start(request, () => undefined)).rejects.toBeInstanceOf(PublicApiError);
    expect(controller.currentJobId).toBeNull();
  });
});
