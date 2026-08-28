"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export interface Toast {
  id: number;
  message: string;
  tone?: "neutral" | "win" | "lose";
}

interface ToastContextValue {
  toast: (message: string, tone?: Toast["tone"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, tone: Toast["tone"] = "neutral") => {
    const id = nextId++;
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(
      () => setToasts((current) => current.filter((t) => t.id !== id)),
      4000,
    );
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto max-w-sm rounded-full border px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur"
            style={{
              animation: "toast-slide-bottom-in .32s cubic-bezier(.16,1,.3,1)",
              background: "rgba(20,20,22,.92)",
              borderColor:
                t.tone === "win"
                  ? "var(--color-up)"
                  : t.tone === "lose"
                    ? "var(--color-down)"
                    : "var(--color-line-strong)",
              color:
                t.tone === "win"
                  ? "var(--color-up)"
                  : t.tone === "lose"
                    ? "var(--color-down)"
                    : "var(--color-text)",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx.toast;
}
