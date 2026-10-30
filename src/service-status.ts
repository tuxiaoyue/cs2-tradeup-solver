import type { ServiceStatusResponse } from "./types";

export interface ServiceStatusView {
  solveEnabled: boolean;
  tone: "ready" | "maintenance" | "unavailable";
  message: string;
}

export function projectServiceStatus(status: ServiceStatusResponse): ServiceStatusView {
  if (status.availability === "AVAILABLE" && status.accepting_jobs) {
    const queueText = status.queue_depth > 0
      ? `Queue: ${status.queue_depth}/${status.max_queued_solves}`
      : "Ready for solve requests";
    return { solveEnabled: true, tone: "ready", message: queueText };
  }

  if (status.availability === "MAINTENANCE") {
    return {
      solveEnabled: false,
      tone: "maintenance",
      message: status.maintenance_message?.trim() || "Daily priority / maintenance window"
    };
  }

  return {
    solveEnabled: false,
    tone: "unavailable",
    message: "Public solving is temporarily unavailable"
  };
}
