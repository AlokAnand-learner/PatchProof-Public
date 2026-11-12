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

/**
 * Run a task while holding a gate slot. The slot remains occupied until the
 * task's returned Promise settles, even if an HTTP response closes earlier.
 */
export async function runWithConcurrencyGate<T>(
  gate: ConcurrencyGate,
  task: () => T | Promise<T>,
): Promise<{ acquired: true; value: T } | { acquired: false }> {
  const release = gate.tryAcquire();
  if (!release) return { acquired: false };
  try {
    return { acquired: true, value: await task() };
  } finally {
    release();
  }
}
