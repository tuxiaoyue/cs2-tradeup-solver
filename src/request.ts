import type { SolveMode, SolveRequest } from "./types";

export function buildSolveRequest(
  mode: SolveMode,
  collectionA: string,
  collectionB?: string | null
): SolveRequest {
  if (!collectionA || !collectionA.trim()) {
    throw new Error("Collection A is required");
  }

  if (mode === "single") {
    return {
      mode: "single",
      collection_a: collectionA,
      collection_b: null
    };
  }

  if (!collectionB || !collectionB.trim()) {
    throw new Error("Collection B is required in Two Collection mode");
  }
  if (collectionA === collectionB) {
    throw new Error("Two Collection mode requires distinct Collections");
  }

  return {
    mode: "dual",
    collection_a: collectionA,
    collection_b: collectionB
  };
}
