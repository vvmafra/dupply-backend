/** Converts reais (front-end input, 2 decimal places) → cents (storage integer). */
export const toCents = (reais: number): number => Math.round(reais * 100);

/** Converts cents (storage integer) → reais with 2 decimal places (front-end output). */
export const toReais = (cents: number): number => Math.round(cents) / 100;
