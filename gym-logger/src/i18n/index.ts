import { useSyncExternalStore } from 'react';

// To språk: norsk (nb) og engelsk (en). Teksten står i par der den brukes: t('Start økt', 'Start workout').
// Språket lagres per enhet, så det gjelder også før innlogging.

export type Lang = 'nb' | 'en';

const KEY = 'gym-lang';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'nb' || saved === 'en') return saved;
  } catch {
    /* lagring utilgjengelig */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'nb';
  return /^(nb|no|nn)\b/.test(nav) ? 'nb' : 'en';
}

let lang: Lang = detect();
const listeners = new Set<() => void>();

function applyDocumentLang() {
  if (typeof document !== 'undefined') document.documentElement.lang = lang === 'nb' ? 'nb' : 'en';
}
applyDocumentLang();

export const getLang = (): Lang => lang;

export function setLang(next: Lang) {
  if (next === lang) return;
  lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignorer */
  }
  applyDocumentLang();
  listeners.forEach((l) => l());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => lang,
    () => lang,
  );
}

/** Teksten på gjeldende språk. */
export function t(nb: string, en: string): string {
  return lang === 'nb' ? nb : en;
}

/** Locale til datoer og tall. */
export const locale = () => (lang === 'nb' ? 'nb-NO' : 'en-GB');
