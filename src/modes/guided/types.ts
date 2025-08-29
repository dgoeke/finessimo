// Guided-mode specific branded types

declare const ColumnBrand: unique symbol;
export type Column = number & { readonly [ColumnBrand]: true };
export function createColumn(value: number): Column {
  if (!Number.isInteger(value) || value < -10 || value > 9) {
    throw new Error("Column must be an integer in [-10,9]");
  }
  return value as Column;
}
export const columnAsNumber = (c: Column): number => c as number;

// SRS-guided identifiers (scoped to guided mode)
declare const CardIdBrand: unique symbol;
export type CardId = string & { readonly [CardIdBrand]: true };
export function createCardId(value: string): CardId {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("CardId must be a non-empty string");
  }
  return value as CardId;
}

declare const DeckIdBrand: unique symbol;
export type DeckId = string & { readonly [DeckIdBrand]: true };
export function createDeckId(value: string): DeckId {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("DeckId must be a non-empty string");
  }
  return value as DeckId;
}
