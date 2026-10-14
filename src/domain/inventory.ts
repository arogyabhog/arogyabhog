export interface RecipeShare {
  ingredientId: string;
  ratioBps: number;
}

export interface IngredientUsage {
  ingredientId: string;
  grams: number;
}

/** Allocate integer grams by largest remainder so recipe usage sums exactly to the pack weight. */
export function allocateIngredientGrams(totalWeightG: number, recipe: readonly RecipeShare[]): IngredientUsage[] {
  if (!Number.isSafeInteger(totalWeightG) || totalWeightG < 1 || recipe.length === 0) {
    throw new Error('Invalid weight or empty recipe');
  }
  if (new Set(recipe.map((line) => line.ingredientId)).size !== recipe.length) {
    throw new Error('Duplicate ingredient in recipe');
  }
  if (recipe.some((line) => !Number.isInteger(line.ratioBps) || line.ratioBps < 1 || line.ratioBps > 10000)) {
    throw new Error('Recipe shares must be positive integer basis points');
  }
  if (recipe.reduce((sum, line) => sum + line.ratioBps, 0) !== 10000) {
    throw new Error('Recipe shares must total 10000 basis points');
  }

  const apportioned = recipe.map((line) => {
    const numerator = BigInt(totalWeightG) * BigInt(line.ratioBps);
    return {
      ingredientId: line.ingredientId,
      grams: Number(numerator / 10000n),
      remainder: numerator % 10000n,
    };
  });
  const remainderGrams = totalWeightG - apportioned.reduce((sum, line) => sum + line.grams, 0);
  const recipients = [...apportioned].sort((a, b) => {
    if (a.remainder === b.remainder) return a.ingredientId.localeCompare(b.ingredientId);
    return a.remainder > b.remainder ? -1 : 1;
  });
  for (let i = 0; i < remainderGrams; i += 1) {
    const recipient = recipients[i];
    if (!recipient) throw new Error('Invalid remainder allocation');
    recipient.grams += 1;
  }
  return apportioned.map(({ ingredientId, grams }) => ({ ingredientId, grams }));
}
