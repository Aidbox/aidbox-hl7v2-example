/**
 * Generic polling service factory.
 *
 * Polls for work items, processes each one, and loops. Used by:
 * - Account BAR builder
 * - BAR message sender
 * - HL7v2 message processor
 *
 * Success → setImmediate for next tick (drain queue).
 * Idle (no item) → setTimeout(pollIntervalMs).
 * Error (poll throws or process throws) → onError + setTimeout(pollIntervalMs).
 */

export interface PollingServiceOptions<T> {
  poll: () => Promise<T | null>;
  process: (item: T) => Promise<void>;
  pollIntervalMs?: number;
  onError?: (error: Error, item?: T) => void;
  onProcessed?: (item: T) => void;
  onIdle?: () => void;
}

export interface PollingService {
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

const DEFAULT_POLL_INTERVAL_MS = 60_000;

export function createPollingService<T>(opts: PollingServiceOptions<T>): PollingService {
  const pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  let running = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  async function tick() {
    if (!running) {return;}

    let currentItem: T | null = null;
    try {
      currentItem = await opts.poll();
      if (!currentItem) {
        opts.onIdle?.();
        timeoutId = setTimeout(tick, pollIntervalMs);
        return;
      }
      await opts.process(currentItem);
      opts.onProcessed?.(currentItem);
      setImmediate(tick);
    } catch (error) {
      opts.onError?.(error as Error, currentItem ?? undefined);
      timeoutId = setTimeout(tick, pollIntervalMs);
    }
  }

  return {
    start() {
      if (running) {return;}
      running = true;
      tick();
    },
    stop() {
      running = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
    isRunning() {
      return running;
    },
  };
}
