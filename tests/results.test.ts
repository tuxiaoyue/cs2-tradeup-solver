import { describe, expect, it } from "vitest";

import { projectStructureRows } from "../src/results";
import { exactBasketDetail } from "../src/basket-detail";
import type { BasketInput, SolveResult, StructureResult } from "../src/types";

function basket(): BasketInput[] {
  return Array.from({ length: 10 }, (_, index) => ({
    listing_id: `listing-${index}`,
    market_hash_name: `Sample Skin ${index} (Field-Tested)`,
    collection_id: index < 8 ? "collection-a" : "collection-b",
    collection_name: index < 8 ? "Alpha Collection" : "Beta Collection",
    wear: "FT",
    float_value: 0.2 + index / 1000,
    price_cny: 4 + index / 10
  }));
}

function structure(overrides: Partial<StructureResult> = {}): StructureResult {
  return {
    structure_id: "structure-1",
    structure_label: "8 Alpha + 2 Beta",
    required_collection_counts: [
      { collection_id: "collection-a", display_name: "Alpha Collection", count: 8 },
      { collection_id: "collection-b", display_name: "Beta Collection", count: 2 }
    ],
    status: "OPTIMAL",
    economics: {
      cost_cny: 44,
      expected_value_cny: 49,
      expected_profit_cny: 5,
      roi: 0.1136
    },
    basket: basket(),
    runtime_seconds: 0.5,
    reason: null,
    ...overrides
  };
}

function result(structures: StructureResult[]): SolveResult {
  return {
    mode: "dual",
    collection_a: { id: "collection-a", display_name: "Alpha Collection" },
    collection_b: { id: "collection-b", display_name: "Beta Collection" },
    market_snapshot_at: "2026-10-30T12:00:00Z",
    solver_version: "sample-solver",
    result_version: "v1",
    structures
  };
}

describe("result projection", () => {
  it("preserves every Structure state instead of filtering failures", () => {
    const rows = projectStructureRows(result([
      structure({ structure_id: "optimal", status: "OPTIMAL" }),
      structure({ structure_id: "infeasible", status: "INFEASIBLE", basket: null }),
      structure({ structure_id: "timeout", status: "TIMEOUT", basket: null }),
      structure({ structure_id: "error", status: "ERROR", basket: null })
    ]));

    expect(rows.map((row) => row.status)).toEqual(["OPTIMAL", "INFEASIBLE", "TIMEOUT", "ERROR"]);
  });

  it("preserves negative profit and ROI", () => {
    const [row] = projectStructureRows(result([
      structure({ economics: {
        cost_cny: 50,
        expected_value_cny: 45,
        expected_profit_cny: -5,
        roi: -0.1
      } })
    ]));

    expect(row.expectedProfitCny).toBe(-5);
    expect(row.roi).toBe(-0.1);
  });

  it("keeps unavailable economics as null instead of zero", () => {
    const [row] = projectStructureRows(result([
      structure({ economics: {
        cost_cny: 44,
        expected_value_cny: null,
        expected_profit_cny: null,
        roi: null
      } })
    ]));

    expect(row.expectedValueCny).toBeNull();
    expect(row.expectedProfitCny).toBeNull();
    expect(row.roi).toBeNull();
  });

  it("keeps non-optimal Structures selectable for status detail without inventing a basket", () => {
    const [row] = projectStructureRows(result([
      structure({ status: "INFEASIBLE", basket: null, reason: "No legal exact basket" })
    ]));

    expect(row.selectable).toBe(true);
    expect(row.hasBasket).toBe(false);
  });
});

describe("exact basket detail", () => {
  it("returns the ten exact inputs for an OPTIMAL Structure", () => {
    const detail = exactBasketDetail(structure());

    expect(detail?.inputs).toHaveLength(10);
    expect(detail?.inputs[0].listing_id).toBe("listing-0");
  });

  it("returns no basket for non-optimal Structures", () => {
    expect(exactBasketDetail(structure({ status: "TIMEOUT", basket: null }))).toBeNull();
  });

  it("fails closed if an OPTIMAL result does not contain exactly ten inputs", () => {
    expect(() => exactBasketDetail(structure({ basket: basket().slice(0, 9) }))).toThrow(/exactly 10/i);
  });
});
