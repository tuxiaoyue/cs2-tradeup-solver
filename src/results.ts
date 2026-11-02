import type { SolveResult, StructureStatus } from "./types";

export interface StructureRowProjection {
  structureId: string;
  label: string;
  status: StructureStatus;
  costCny: number | null;
  expectedValueCny: number | null;
  expectedProfitCny: number | null;
  roi: number | null;
  runtimeSeconds: number | null;
  selectable: true;
  hasBasket: boolean;
}

export function projectStructureRows(result: SolveResult): StructureRowProjection[] {
  return result.structures.map((structure) => ({
    structureId: structure.structure_id,
    label: structure.structure_label,
    status: structure.status,
    costCny: structure.economics?.cost_cny ?? null,
    expectedValueCny: structure.economics?.expected_value_cny ?? null,
    expectedProfitCny: structure.economics?.expected_profit_cny ?? null,
    roi: structure.economics?.roi ?? null,
    runtimeSeconds: structure.runtime_seconds ?? null,
    selectable: true,
    hasBasket: structure.status === "OPTIMAL" && Array.isArray(structure.basket)
  }));
}
