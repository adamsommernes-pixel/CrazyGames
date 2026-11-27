import { useEffect, useSyncExternalStore } from 'react';
import { Icon } from './Icon';
import { t } from '../i18n';

// Kort melding nederst på skjermen, med valgfri «Angre»-knapp.
// Samme enkle store-mønster som confirm.tsx.

interface Toast {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void | Promise<void> };
  ms: number;
}

let current: Toast | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(message: string, action?: Toast['action'], ms = 5000) {
  current = { id: ++seq, message, action, ms };
  emit();
}

/** Melding med «Angre» etter en sletting. */
export function undoToast(message: string, undo: () => void | Promise<void>) {
  showToast(message, { label: t('Angre', 'Undo'), onClick: undo });
}

function dismiss(id: number) {
  if (current?.id === id) {
    current = null;
    emit();
  }
}

export function ToastHost() {
  const toast = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => dismiss(toast.id), toast.ms);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <div className="mx-auto w-full max-w-xl px-3 pb-2" role="status" aria-live="polite">
      <div key={toast.id} className="flex animate-rise items-center gap-3 rounded-xl border border-line bg-raised py-2 pr-2 pl-4 shadow-lg shadow-black">
        <span className="flex-1 text-sm">{toast.message}</span>
        {toast.action && (
          <button
            type="button"
            className="min-h-10 rounded-xl px-3 font-semibold text-accent active:bg-line"
            onClick={async () => {
              dismiss(toast.id);
              await toast.action!.onClick();
            }}
          >
            {toast.action.label}
          </button>
        )}
        <button type="button" aria-label={t('Lukk melding', 'Dismiss message')} className="grid size-10 place-items-center rounded-xl text-faint active:bg-line" onClick={() => dismiss(toast.id)}>
          <Icon name="x" size={18} />
        </button>
      </div>
    </div>
  );
}
