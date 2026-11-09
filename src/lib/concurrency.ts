// Runs `task` over every input with at most `limit` tasks in flight at once.
// Each task handles its own errors; a rejected task does not stop the others.
export async function forEachWithConcurrency<T>(
  inputs: readonly T[],
  limit: number,
  task: (input: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workerCount = Math.max(1, Math.min(limit, inputs.length));

  async function worker() {
    while (next < inputs.length) {
      const index = next;
      next += 1;
      try {
        await task(inputs[index], index);
      } catch {
        // Callers record per-item failures themselves.
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker));
}
