import { useSyncExternalStore } from 'react';
import { Button, Sheet } from './ui';

// Egen bekreftelsesdialog i appen. Nettleserens confirm()/alert() blokkeres i
// enkelte innebygde visninger, og ser dessuten fremmed ut i en installert app.

interface Request {
  message: string;
  confirmLabel: string;
  danger: boolean;
  /** Bare én knapp (informasjon). */
  info: boolean;
  resolve: (ok: boolean) => void;
}

let current: Request | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function askConfirm(
  message: string,
  opts: { confirmLabel?: string; danger?: boolean } = {},
): Promise<boolean> {
  current?.resolve(false);
  return new Promise((resolve) => {
    current = { message, confirmLabel: opts.confirmLabel ?? 'OK', danger: opts.danger ?? true, info: false, resolve };
    emit();
  });
}

export function showInfo(message: string): Promise<boolean> {
  current?.resolve(false);
  return new Promise((resolve) => {
    current = { message, confirmLabel: 'OK', danger: false, info: true, resolve };
    emit();
  });
}

function close(ok: boolean) {
  current?.resolve(ok);
  current = null;
  emit();
}

export function ConfirmHost() {
  const req = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  return (
    <Sheet open={!!req} onClose={() => close(false)} title={req?.info ? 'Merk' : 'Er du sikker?'}>
      {req && (
        <>
          <p className="mb-5 text-muted">{req.message}</p>
          <div className="flex gap-2">
            {!req.info && (
              <Button variant="secondary" className="flex-1" onClick={() => close(false)}>
                Avbryt
              </Button>
            )}
            <Button variant={req.danger ? 'danger' : 'primary'} className="flex-1" onClick={() => close(true)}>
              {req.confirmLabel}
            </Button>
          </div>
        </>
      )}
    </Sheet>
  );
}
