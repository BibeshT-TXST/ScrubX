import type { PhiType } from "../types";

export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

export function listCounts(counts: Partial<Record<PhiType, number>>): string {
  return Object.entries(counts)
    .map(([type, n]) => `${n} ${type.toLowerCase()}`)
    .join(", ");
}
