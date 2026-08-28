"use client";

/** Client error log. Captures window errors and unhandled rejections. */

import { useEffect, useState } from "react";
import Panel from "@/components/shell/Panel";
import { MenuSection } from "@/components/menu/MenuUI";
import TapTarget from "@/components/ui/TapTarget";
import { useRequireAdmin } from "@/lib/games/lab";

interface LoggedError {
  id: number;
  message: string;
  source: string;
  at: string;
  resolved: boolean;
}

let nextId = 0;

export default function ErrorsPage() {
  const admin = useRequireAdmin();
  const [errors, setErrors] = useState<LoggedError[]>([]);

  useEffect(() => {
    const add = (message: string, source: string) =>
      setErrors((prev) => [
        {
          id: nextId++,
          message,
          source,
          at: new Date().toISOString(),
          resolved: false,
        },
        ...prev.slice(0, 49),
      ]);

    const onError = (event: ErrorEvent) =>
      add(event.message, `${event.filename}:${event.lineno}`);
    const onRejection = (event: PromiseRejectionEvent) =>
      add(String(event.reason), "unhandled rejection");

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  const open = errors.filter((e) => !e.resolved).length;

  return (
    <Panel
      title="Errors"
      backHref="/admin"
      screenLabel="Errors"
      status={{ left: "ERRORS", right: String(open) }}
    >
      {!admin ? (
        <p className="py-10 text-center text-sm text-text-3">
          Admin access only.
        </p>
      ) : errors.length === 0 ? (
        <p className="py-10 text-center text-sm text-text-3">
          No client errors captured this session.
        </p>
      ) : (
        <MenuSection title={`${open} open`}>
          {errors.map((error) => (
            <div
              key={error.id}
              className="border-b border-[var(--color-line)] px-4 py-3 last:border-b-0"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div
                    className={`break-words text-sm font-bold ${
                      error.resolved ? "text-text-3 line-through" : "text-down"
                    }`}
                  >
                    {error.message}
                  </div>
                  <div className="truncate font-mono text-[11px] text-text-3">
                    {error.source}
                  </div>
                  <div className="text-[11px] text-text-3">
                    {new Date(error.at).toLocaleTimeString()}
                  </div>
                </div>
                <TapTarget
                  className="shrink-0 rounded-full border border-[var(--color-line-strong)] px-3 py-1 text-[11px] font-bold text-text-2"
                  onClick={() =>
                    setErrors((prev) =>
                      prev.map((e) =>
                        e.id === error.id ? { ...e, resolved: !e.resolved } : e,
                      ),
                    )
                  }
                >
                  {error.resolved ? "Reopen" : "Resolve"}
                </TapTarget>
              </div>
            </div>
          ))}
        </MenuSection>
      )}
    </Panel>
  );
}
