import type { Collection, SolveMode } from "./types";

export interface CollectionOption {
  value: string;
  label: string;
}

export interface NormalizedSelection {
  collectionA: string;
  collectionB: string | null;
}

export function collectionOptions(collections: Collection[]): CollectionOption[] {
  return collections.map((collection) => ({
    value: collection.id,
    label: collection.display_name
  }));
}

export function normalizeSelection(
  mode: SolveMode,
  collectionA: string,
  collectionB?: string | null
): NormalizedSelection {
  if (mode === "single") {
    return { collectionA, collectionB: null };
  }

  if (collectionA && collectionB && collectionA === collectionB) {
    throw new Error("Two Collection mode requires different Collections");
  }

  return { collectionA, collectionB: collectionB ?? null };
}
