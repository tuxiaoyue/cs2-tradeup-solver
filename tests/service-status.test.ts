import { describe, expect, it } from "vitest";

import { projectServiceStatus } from "../src/service-status";

describe("service status projection", () => {
  it("allows solving only when the service is available and accepting jobs", () => {
    expect(projectServiceStatus({
      availability: "AVAILABLE",
      accepting_jobs: true,
      active_solves: 0,
      max_active_solves: 1,
      queue_depth: 0,
      max_queued_solves: 20,
      updated_at: "2026-10-30T12:00:00Z"
    }).solveEnabled).toBe(true);
  });

  it("disables solving and exposes maintenance text", () => {
    const state = projectServiceStatus({
      availability: "MAINTENANCE",
      accepting_jobs: false,
      active_solves: 0,
      max_active_solves: 1,
      queue_depth: 2,
      max_queued_solves: 20,
      maintenance_message: "Daily priority window",
      updated_at: "2026-10-30T12:00:00Z"
    });

    expect(state.solveEnabled).toBe(false);
    expect(state.message).toContain("Daily priority window");
  });

  it("disables solving when unavailable", () => {
    expect(projectServiceStatus({
      availability: "UNAVAILABLE",
      accepting_jobs: false,
      active_solves: 0,
      max_active_solves: 1,
      queue_depth: 0,
      max_queued_solves: 20,
      updated_at: "2026-10-30T12:00:00Z"
    }).solveEnabled).toBe(false);
  });
});
