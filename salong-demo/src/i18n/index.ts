import { salon } from "@config";
import { nb, type Dictionary } from "./nb";

const dictionaries: Record<string, Dictionary> = { "nb-NO": nb };

/** UI strings for the salon's configured locale. */
export const t: Dictionary = dictionaries[salon.locale] ?? nb;
export type { Dictionary };
