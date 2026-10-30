export interface Collection {
  id: string;
  display_name: string;
}

export interface CollectionCatalogResponse {
  catalog_version: string;
  collections: Collection[];
}

export type ServiceAvailability = "AVAILABLE" | "MAINTENANCE" | "UNAVAILABLE";

export interface ServiceStatusResponse {
  availability: ServiceAvailability;
  accepting_jobs: boolean;
  active_solves: number;
  max_active_solves: number;
  queue_depth: number;
  max_queued_solves: number;
  maintenance_message?: string | null;
  updated_at: string;
}

export type SolveMode = "single" | "dual";

export type SolveRequest =
  | { mode: "single"; collection_a: string; collection_b: null }
  | { mode: "dual"; collection_a: string; collection_b: string };

export interface SolveAcceptedResponse {
  job_id: string;
  status: "QUEUED";
  submitted_at: string;
  queue_position?: number | null;
}

export type JobState = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";

export interface JobProgress {
  structures_completed: number;
  structures_total: number;
}

export interface CollectionCount {
  collection_id: string;
  display_name: string;
  count: number;
}

export interface BasketInput {
  listing_id: string;
  market_hash_name: string;
  collection_id: string;
  collection_name: string;
  wear: string;
  float_value: number;
  price_cny: number;
}

export interface Economics {
  cost_cny: number | null;
  expected_value_cny: number | null;
  expected_profit_cny: number | null;
  roi: number | null;
}

export type StructureStatus = "OPTIMAL" | "INFEASIBLE" | "TIMEOUT" | "ERROR";

export interface StructureResult {
  structure_id: string;
  structure_label: string;
  required_collection_counts: CollectionCount[];
  status: StructureStatus;
  economics: Economics;
  basket: BasketInput[] | null;
  runtime_seconds?: number | null;
  reason?: string | null;
}

export interface SolveResult {
  mode: SolveMode;
  collection_a: Collection;
  collection_b: Collection | null;
  market_snapshot_at: string;
  solver_version: string;
  result_version: string;
  structures: StructureResult[];
}

export interface PublicJobError {
  code: "SOLVE_FAILED" | "SOLVE_TIMEOUT" | "SERVICE_RESTARTED";
  message: string;
}

export interface JobResponse {
  job_id: string;
  status: JobState;
  submitted_at: string;
  started_at: string | null;
  completed_at: string | null;
  queue_position: number | null;
  progress: JobProgress | null;
  elapsed_seconds: number | null;
  result: SolveResult | null;
  error: PublicJobError | null;
}
