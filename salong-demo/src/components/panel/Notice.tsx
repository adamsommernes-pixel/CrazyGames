"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

const NoticeContext = createContext<(message: string) => void>(() => {});

/** A polite live region for short confirmations ("Lagret", "Bestillingen er flyttet"). */
export function NoticeProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState("");
  const timer = useRef<number | undefined>(undefined);
  const notify = useCallback((text: string) => {
    window.clearTimeout(timer.current);
    setMessage(text);
    timer.current = window.setTimeout(() => setMessage(""), 4000);
  }, []);
  return (
    <NoticeContext.Provider value={notify}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
      >
        {message && <p className="rounded-ctl bg-ink px-5 py-3 text-small text-paper">{message}</p>}
      </div>
    </NoticeContext.Provider>
  );
}

export const useNotice = () => useContext(NoticeContext);
