/** Small in-process concurrency gate for expensive local analysis/provider work. */
export interface ConcurrencyGate {
  tryAcquire(): (() => void) | null;
  activeCount(): number;
}

export function createConcurrencyGate(maxConcurrent: number): ConcurrencyGate {
  if (!Number.isSafeInteger(maxConcurrent) || maxConcurrent < 1) {
    throw new Error('Concurrency limit must be a positive safe integer.');
  }
  let active = 0;
  return {
    tryAcquire() {
      if (active >= maxConcurrent) return null;
      active += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        active = Math.max(0, active - 1);
      };
    },
    activeCount: () => active
  };
}
