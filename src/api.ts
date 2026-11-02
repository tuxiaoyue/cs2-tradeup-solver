import type {
  CollectionCatalogResponse,
  JobResponse,
  ServiceStatusResponse,
  SolveAcceptedResponse,
  SolveRequest
} from "./types";

export class PublicApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "PublicApiError";
    this.status = status;
    this.code = code;
  }
}

export class SolverApi {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  getCollections(): Promise<CollectionCatalogResponse> {
    return this.request("/v1/collections");
  }

  getServiceStatus(): Promise<ServiceStatusResponse> {
    return this.request("/v1/service-status");
  }

  submitSolve(request: SolveRequest): Promise<SolveAcceptedResponse> {
    return this.request("/v1/solve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request)
    });
  }

  getJob(jobId: string): Promise<JobResponse> {
    return this.request(`/v1/jobs/${encodeURIComponent(jobId)}`);
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, init);
    const payload = await response.json().catch(() => null) as unknown;

    if (!response.ok) {
      const error = extractPublicError(payload);
      throw new PublicApiError(response.status, error.code, error.message);
    }

    return payload as T;
  }
}

function extractPublicError(payload: unknown): { code: string; message: string } {
  if (payload && typeof payload === "object" && "error" in payload) {
    const nested = (payload as { error?: unknown }).error;
    if (nested && typeof nested === "object") {
      const code = "code" in nested ? String((nested as { code?: unknown }).code ?? "REQUEST_FAILED") : "REQUEST_FAILED";
      const message = "message" in nested ? String((nested as { message?: unknown }).message ?? "Request failed") : "Request failed";
      return { code, message };
    }
  }
  return { code: "REQUEST_FAILED", message: "Request failed" };
}
