/**
 * In-process polling workers.
 *
 * Boots the three polling services (inbound ORU/ADT/VXU processor, BAR account
 * builder, BAR message sender) inside the web server so messages flow through
 * the pipeline without manual UI clicks.
 *
 * Controlled by env:
 * - `DISABLE_POLLING=1` — do not start any workers.
 * - `POLL_INTERVAL_MS` — poll interval in ms. Default 1000.
 *   Use 60000 for production-like runs; the underlying service
 *   default of 60000 applies when individual services are run standalone.
 */
import { createIncomingHL7v2MessageProcessorService } from "./v2-to-fhir/processor-service";
import type { IncomingHL7v2Message } from "./fhir/aidbox-hl7v2-custom/IncomingHl7v2message";
import { createAccountBarBuilderService } from "./bar/account-builder-service";
import {
  createBarMessageSenderService,
  type OutgoingBarMessage,
} from "./bar/sender-service";
import type { PollingService } from "./polling-service";

export interface WorkersHandle {
  stop: () => void;
  isRunning: () => boolean;
  /** Exposed for tests. */
  services: {
    inboundProcessor: PollingService;
    accountBuilder: PollingService;
    barSender: PollingService;
  };
}

export interface StartWorkersOptions {
  pollIntervalMs?: number;
  /** Defaults to `console`. Injected for testability. */
  logger?: Pick<Console, "log" | "error">;
  /**
   * Factories for each service. Injected for testability so we don't need to
   * mock.module the underlying services.
   */
  factories?: {
    inboundProcessor?: typeof createIncomingHL7v2MessageProcessorService;
    accountBuilder?: typeof createAccountBarBuilderService;
    barSender?: typeof createBarMessageSenderService;
  };
}

const DEFAULT_DEMO_POLL_INTERVAL_MS = 1_000;

export type WorkerStatus = "up" | "down" | "disabled";

export interface WorkerHealth {
  oruProcessor: WorkerStatus;
  barBuilder: WorkerStatus;
  barSender: WorkerStatus;
}

/**
 * Snapshot per-service running state for the Dashboard. When polling is
 * disabled (handle = null) or the handle is absent, returns all
 * "disabled" rather than throwing — the dashboard must render even on
 * a dev box that booted with DISABLE_POLLING=1.
 */
export function getWorkerHealth(
  handle: WorkersHandle | null | undefined,
): WorkerHealth {
  if (!handle) {
    return {
      oruProcessor: "disabled",
      barBuilder: "disabled",
      barSender: "disabled",
    };
  }
  const status = (s: PollingService): WorkerStatus =>
    s.isRunning() ? "up" : "down";
  return {
    oruProcessor: status(handle.services.inboundProcessor),
    barBuilder: status(handle.services.accountBuilder),
    barSender: status(handle.services.barSender),
  };
}

export function resolvePollIntervalMs(
  explicit: number | undefined,
  env: NodeJS.ProcessEnv = process.env,
): number {
  if (typeof explicit === "number") return explicit;
  const fromEnv = env.POLL_INTERVAL_MS;
  if (fromEnv) {
    const n = Number.parseInt(fromEnv, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_DEMO_POLL_INTERVAL_MS;
}

export function isPollingDisabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.DISABLE_POLLING === "1";
}

/**
 * Start all three polling services. Call `.stop()` on the returned handle for
 * graceful shutdown.
 */
export function startAllPollingServices(
  options: StartWorkersOptions = {},
): WorkersHandle {
  const log = options.logger ?? console;
  const pollIntervalMs = resolvePollIntervalMs(options.pollIntervalMs);

  const makeInboundProcessor =
    options.factories?.inboundProcessor ??
    createIncomingHL7v2MessageProcessorService;
  const makeAccountBuilder =
    options.factories?.accountBuilder ?? createAccountBarBuilderService;
  const makeBarSender =
    options.factories?.barSender ?? createBarMessageSenderService;

  const inboundProcessor = makeInboundProcessor({
    pollIntervalMs,
    onError: (error: Error, message?: IncomingHL7v2Message) => {
      log.error(
        `[worker:inbound] error on ${message?.id ?? "unknown"}: ${error.message}`,
      );
    },
    onProcessed: (message: IncomingHL7v2Message) => {
      log.log(
        `[worker:inbound] processed ${message.type} ${message.id} → ${message.patient?.reference ?? "no patient"}`,
      );
    },
  });

  const accountBuilder = makeAccountBuilder({
    pollIntervalMs,
    onError: (error: Error) => {
      log.error(`[worker:account-builder] error: ${error.message}`);
    },
    onProcessed: (account) => {
      log.log(`[worker:account-builder] built BAR for account ${account.id}`);
    },
  });

  const barSender = makeBarSender({
    pollIntervalMs,
    onError: (error: Error, message?: OutgoingBarMessage) => {
      log.error(
        `[worker:bar-sender] error on ${message?.id ?? "unknown"}: ${error.message}`,
      );
    },
    onProcessed: (message: OutgoingBarMessage) => {
      log.log(`[worker:bar-sender] sent ${message.id}`);
    },
  });

  inboundProcessor.start();
  accountBuilder.start();
  barSender.start();

  log.log(
    `[workers] started inbound-processor + account-builder + bar-sender (poll every ${pollIntervalMs}ms)`,
  );

  let stopped = false;
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      inboundProcessor.stop();
      accountBuilder.stop();
      barSender.stop();
      log.log("[workers] stopped");
    },
    isRunning: () =>
      !stopped &&
      (inboundProcessor.isRunning() ||
        accountBuilder.isRunning() ||
        barSender.isRunning()),
    services: { inboundProcessor, accountBuilder, barSender },
  };
}
