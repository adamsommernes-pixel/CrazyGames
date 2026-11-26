// English names and guides for the built-in exercises, keyed by slug.
import { UPPER_EN } from './en/upper';
import { ARMS_EN } from './en/arms';
import { LOWER_EN } from './en/lower';
import { CORE_EN } from './en/core';

export interface EnglishEntry {
  name: string;
  steps: string[];
  tips: string[];
  mistakes: string[];
}

export const EN: Record<string, EnglishEntry> = Object.fromEntries(
  [...UPPER_EN, ...ARMS_EN, ...LOWER_EN, ...CORE_EN].map(([slug, name, steps, tips, mistakes]) => [slug, { name, steps, tips, mistakes }]),
);
