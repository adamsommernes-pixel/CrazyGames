// English names and guides for the built-in exercises, keyed by slug. Filled in below.
export interface EnglishEntry {
  name: string;
  steps: string[];
  tips: string[];
  mistakes: string[];
}

export const EN: Record<string, EnglishEntry> = {};
