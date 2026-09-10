"use client";

/**
 * One polling interval, shared by every caller and stopped by the last one.
 *
 * The trackers in this folder are singletons started from mount effects, so two
 * components can be watching the same thing at once. Both ways of getting that
 * wrong shipped here: `markets` reused its interval with `??=` but handed every
 * caller a disposer that cleared it, so the first unmount stopped polling for
 * the survivors; `book` and `positions` replaced the interval on every call,
 * which is right when the target changes and wasteful when it has not.
 *
 * So: refcount the callers, and replace the interval only when the target
 * changes. `id` names the target — a pool address, a market id, or a constant
 * for a tracker that follows only one thing.
 */
export function createPoller() {
  let timer: ReturnType<typeof setInterval> | null = null;
  let id: string | null = null;
  let run: (() => Promise<void> | void) | null = null;
  let callers = 0;

  return {
    /** Start or join the poll for `id`. The disposer only stops the last caller. */
    track(nextId: string, everyMs: number, tick: () => Promise<void> | void) {
      callers += 1;
      if (!timer || id !== nextId) {
        if (timer) clearInterval(timer);
        id = nextId;
        run = tick;
        timer = setInterval(() => void run?.(), everyMs);
      }
      void tick();

      let released = false;
      return () => {
        if (released) return;
        released = true;
        callers -= 1;
        if (callers > 0) return;
        if (timer) clearInterval(timer);
        timer = null;
        id = null;
        run = null;
      };
    },

    /** Re-run the tick now. No-op when nothing is being tracked. */
    refresh: () => run?.(),
  };
}
