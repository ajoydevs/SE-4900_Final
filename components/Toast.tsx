"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ToastCtx = { show: (message: string) => void };

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);

  const show = useCallback((message: string) => {
    setMsg(message);
    window.setTimeout(() => setMsg(null), 2500);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {msg ? (
        <div
          className="fixed bottom-6 right-6 z-50 rounded-md bg-slate-900 px-4 py-2 text-sm text-white shadow-lg"
          role="status"
        >
          {msg}
        </div>
      ) : null}
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast requires ToastProvider");
  return v;
}
