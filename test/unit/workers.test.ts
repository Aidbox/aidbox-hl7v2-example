import { test, expect, describe, mock } from "bun:test";
import {
  startAllPollingServices,
  resolvePollIntervalMs,
  isPollingDisabled,
} from "../../src/workers";
import type { PollingService } from "../../src/polling-service";

function makeFakeService(): PollingService & {
  started: boolean;
  stopped: boolean;
} {
  let started = false;
  let stopped = false;
  const svc: PollingService & { started: boolean; stopped: boolean } = {
    start() {
      started = true;
    },
    stop() {
      stopped = true;
    },
    isRunning() {
      return started && !stopped;
    },
    get started() {
      return started;
    },
    get stopped() {
      return stopped;
    },
  };
  return svc;
}

describe("resolvePollIntervalMs", () => {
  test("defaults to 1000 when nothing set", () => {
    expect(resolvePollIntervalMs(undefined, {})).toBe(1_000);
  });

  test("explicit argument wins over env", () => {
    expect(resolvePollIntervalMs(123, { POLL_INTERVAL_MS: "999" })).toBe(123);
  });

  test("reads valid POLL_INTERVAL_MS from env", () => {
    expect(resolvePollIntervalMs(undefined, { POLL_INTERVAL_MS: "250" })).toBe(
      250,
    );
  });

  test("falls back to default for invalid env", () => {
    expect(
      resolvePollIntervalMs(undefined, { POLL_INTERVAL_MS: "not-a-number" }),
    ).toBe(1_000);
    expect(resolvePollIntervalMs(undefined, { POLL_INTERVAL_MS: "-1" })).toBe(
      1_000,
    );
  });
});

describe("isPollingDisabled", () => {
  test("true only when DISABLE_POLLING=1", () => {
    expect(isPollingDisabled({})).toBe(false);
    expect(isPollingDisabled({ DISABLE_POLLING: "" })).toBe(false);
    expect(isPollingDisabled({ DISABLE_POLLING: "0" })).toBe(false);
    expect(isPollingDisabled({ DISABLE_POLLING: "true" })).toBe(false);
    expect(isPollingDisabled({ DISABLE_POLLING: "1" })).toBe(true);
  });
});

describe("startAllPollingServices", () => {
  const quietLogger = { log: mock(() => {}), error: mock(() => {}) };

  test("starts all three services", () => {
    const inbound = makeFakeService();
    const accounts = makeFakeService();
    const sender = makeFakeService();

    const handle = startAllPollingServices({
      pollIntervalMs: 100,
      logger: quietLogger,
      factories: {
        inboundProcessor: () => inbound,
        accountBuilder: () => accounts,
        barSender: () => sender,
      },
    });

    expect(inbound.started).toBe(true);
    expect(accounts.started).toBe(true);
    expect(sender.started).toBe(true);
    expect(handle.isRunning()).toBe(true);

    handle.stop();
  });

  test("stop() halts all three services and is idempotent", () => {
    const inbound = makeFakeService();
    const accounts = makeFakeService();
    const sender = makeFakeService();

    const handle = startAllPollingServices({
      pollIntervalMs: 100,
      logger: quietLogger,
      factories: {
        inboundProcessor: () => inbound,
        accountBuilder: () => accounts,
        barSender: () => sender,
      },
    });

    handle.stop();

    expect(inbound.stopped).toBe(true);
    expect(accounts.stopped).toBe(true);
    expect(sender.stopped).toBe(true);
    expect(handle.isRunning()).toBe(false);

    // Second stop() is a no-op — must not throw.
    handle.stop();
    expect(handle.isRunning()).toBe(false);
  });

  test("passes pollIntervalMs through to each service factory", () => {
    const received: Array<{ pollIntervalMs?: number }> = [];
    const capture = (opts?: { pollIntervalMs?: number }): PollingService => {
      received.push(opts ?? {});
      return makeFakeService();
    };

    const handle = startAllPollingServices({
      pollIntervalMs: 777,
      logger: quietLogger,
      factories: {
        inboundProcessor: capture,
        accountBuilder: capture,
        barSender: capture,
      },
    });

    expect(received).toHaveLength(3);
    for (const opts of received) {
      expect(opts.pollIntervalMs).toBe(777);
    }

    handle.stop();
  });
});
