import { describe, expect, it } from "vitest";

describe("buildSolveRequest", () => {
  it("serializes single mode with collection_b null", async () => {
    const { buildSolveRequest } = await import("../src/request");
    expect(buildSolveRequest("single", "sample-alpha", "sample-beta")).toEqual({
      mode: "single",
      collection_a: "sample-alpha",
      collection_b: null
    });
  });

  it("serializes dual mode with two distinct collection IDs", async () => {
    const { buildSolveRequest } = await import("../src/request");
    expect(buildSolveRequest("dual", "sample-alpha", "sample-beta")).toEqual({
      mode: "dual",
      collection_a: "sample-alpha",
      collection_b: "sample-beta"
    });
  });

  it("rejects duplicate dual Collections", async () => {
    const { buildSolveRequest } = await import("../src/request");
    expect(() => buildSolveRequest("dual", "sample-alpha", "sample-alpha")).toThrow(
      "Two Collection mode requires distinct Collections"
    );
  });

  it("rejects a missing Collection A", async () => {
    const { buildSolveRequest } = await import("../src/request");
    expect(() => buildSolveRequest("single", "")).toThrow("Collection A is required");
  });
});
