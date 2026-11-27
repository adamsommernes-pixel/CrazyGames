import { Component, type ReactNode } from 'react';

// Vises i stedet for en mørk, tom skjerm når noe går galt ved oppstart.
// Bevisst uten t() og uten avhengigheter, så den virker selv om resten av appen ikke gjør det.

export function ErrorScreen({ title, message, hint }: { title: string; message: string; hint?: string }) {
  return (
    <div role="alert" style={{ minHeight: '100%', display: 'grid', placeItems: 'center', padding: 24, background: '#07090a', color: '#f2f5f3', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 420 }}>
        <h1 style={{ fontSize: 24, margin: '0 0 8px' }}>{title}</h1>
        <p style={{ color: '#9aa59f', margin: '0 0 12px', lineHeight: 1.5 }}>{message}</p>
        {hint && <p style={{ color: '#9aa59f', margin: '0 0 16px', lineHeight: 1.5, fontSize: 14 }}>{hint}</p>}
        <button
          type="button"
          onClick={async () => {
            // Fjern gammel offline-kopi og last på nytt, i tilfelle en utdatert versjon henger igjen.
            try {
              for (const r of (await navigator.serviceWorker?.getRegistrations()) ?? []) await r.unregister();
              for (const k of (await caches?.keys()) ?? []) await caches.delete(k);
            } catch {
              /* ignorer */
            }
            location.reload();
          }}
          style={{ minHeight: 48, padding: '0 20px', borderRadius: 14, border: 0, background: '#f2f2f3', color: '#000', fontWeight: 700, fontSize: 16 }}
        >
          Last inn på nytt / Reload
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <ErrorScreen
          title="Noe gikk galt / Something went wrong"
          message={this.state.error.message}
          hint="Dataene dine er trygge. Prøv å laste inn på nytt. / Your data is safe. Try reloading."
        />
      );
    }
    return this.props.children;
  }
}
