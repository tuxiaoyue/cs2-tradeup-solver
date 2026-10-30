import { describe, expect, it } from "vitest";

import { collectionOptions, normalizeSelection } from "../src/catalog";

describe("collection selection", () => {
  it("clears Collection B when switching to single mode", () => {
    expect(normalizeSelection("single", "collection-a", "collection-b")).toEqual({
      collectionA: "collection-a",
      collectionB: null
    });
  });

  it("rejects duplicate Collections in dual mode", () => {
    expect(() => normalizeSelection("dual", "collection-a", "collection-a")).toThrow(
      /different Collections/i
    );
  });

  it("keeps server IDs separate from display names", () => {
    const options = collectionOptions([
      { id: "collection-a", display_name: "The Alpha Collection" }
    ]);

    expect(options).toEqual([
      { value: "collection-a", label: "The Alpha Collection" }
    ]);
  });
});
