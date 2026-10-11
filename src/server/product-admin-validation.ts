export interface RecipeRatioInput {
  ingredientId: string;
  ratioBps: number;
}

/** Ratios must cover the current recipe exactly and total 100%, with no duplicate rows. */
export function validRecipeRatios(currentIngredientIds: string[], submitted: RecipeRatioInput[]): boolean {
  if (currentIngredientIds.length === 0 || submitted.length !== currentIngredientIds.length) return false;
  if (new Set(currentIngredientIds).size !== currentIngredientIds.length) return false;
  if (new Set(submitted.map((line) => line.ingredientId)).size !== submitted.length) return false;
  const expected = new Set(currentIngredientIds);
  if (submitted.some((line) => !expected.has(line.ingredientId))) return false;
  if (submitted.some((line) => !Number.isInteger(line.ratioBps) || line.ratioBps < 1 || line.ratioBps > 10000)) {
    return false;
  }
  return submitted.reduce((sum, line) => sum + line.ratioBps, 0) === 10000;
}
