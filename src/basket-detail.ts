import type { BasketInput, Economics, StructureResult } from "./types";

export interface ExactBasketDetail {
  structureId: string;
  label: string;
  inputs: BasketInput[];
  economics: Economics;
  runtimeSeconds: number | null;
}

export function exactBasketDetail(structure: StructureResult): ExactBasketDetail | null {
  if (structure.status !== "OPTIMAL") {
    return null;
  }

  if (!Array.isArray(structure.basket) || structure.basket.length !== 10) {
    throw new Error("An OPTIMAL exact basket must contain exactly 10 inputs");
  }

  return {
    structureId: structure.structure_id,
    label: structure.structure_label,
    inputs: structure.basket,
    economics: structure.economics,
    runtimeSeconds: structure.runtime_seconds ?? null
  };
}
