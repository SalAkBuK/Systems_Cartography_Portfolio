/**
 * PURE FLAGSHIP SELECTION MODEL
 *
 * Shared state rules for flagship project curation:
 * - Maximum 4 items
 * - No duplicates
 * - Reorderable
 * - Add / Remove / Move
 * - Explicit selection rule: at max capacity, additions are rejected (no implicit replacement)
 */

export const MAX_FLAGSHIP_COUNT = 4;

export interface FlagshipSelectionResult {
  selectedIds: string[];
  success: boolean;
  error?: string;
}

/**
 * Attempts to add an item to the selected list.
 * Rejects if max count reached or already present.
 */
export function addFlagshipItem(
  currentSelectedIds: string[],
  newId: string,
  maxLimit: number = MAX_FLAGSHIP_COUNT
): FlagshipSelectionResult {
  if (!newId || typeof newId !== 'string' || !newId.trim()) {
    return { selectedIds: [...currentSelectedIds], success: false, error: 'Invalid project ID' };
  }

  const cleanId = newId.trim();

  if (currentSelectedIds.includes(cleanId)) {
    return { selectedIds: [...currentSelectedIds], success: true };
  }

  if (currentSelectedIds.length >= maxLimit) {
    return {
      selectedIds: [...currentSelectedIds],
      success: false,
      error: 'MAXIMUM FLAGSHIPS REACHED // REMOVE ONE FIRST'
    };
  }

  return {
    selectedIds: [...currentSelectedIds, cleanId],
    success: true
  };
}

/**
 * Removes an item from the selected list.
 */
export function removeFlagshipItem(
  currentSelectedIds: string[],
  idToRemove: string
): string[] {
  return currentSelectedIds.filter(id => id !== idToRemove);
}

/**
 * Reorders an item by moving it from fromIndex to toIndex.
 */
export function reorderFlagshipItem(
  currentSelectedIds: string[],
  fromIndex: number,
  toIndex: number
): string[] {
  if (
    fromIndex < 0 ||
    fromIndex >= currentSelectedIds.length ||
    toIndex < 0 ||
    toIndex >= currentSelectedIds.length ||
    fromIndex === toIndex
  ) {
    return [...currentSelectedIds];
  }

  const copy = [...currentSelectedIds];
  const [item] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, item);
  return copy;
}

/**
 * Moves an item by delta (-1 for up, +1 for down).
 */
export function moveFlagshipItem(
  currentSelectedIds: string[],
  index: number,
  delta: number
): string[] {
  const targetIndex = index + delta;
  return reorderFlagshipItem(currentSelectedIds, index, targetIndex);
}
