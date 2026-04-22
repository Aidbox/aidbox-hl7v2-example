/**
 * Batch-import HL7v2 messages from a zip archive or directory into Aidbox.
 *
 * Usage:
 *   bun scripts/import-batch.ts <zip|dir> [--tag <name>]
 *
 * - Walks the archive/dir recursively, reads each file.
 * - Strips RTF wrappers and splits multi-message files (one MSH = one message).
 * - Creates IncomingHL7v2Message resources with status=received and
 *   batchTag set so the batch can later be filtered and bulk-retried.
 * - Default tag: <source-basename>-<yyyyMMddHHmmss>.
 *
 * The usual polling worker (src/workers.ts) picks up received messages and
 * runs the normal pipeline.
 */

import { readdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename, extname, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { aidboxFetch } from "../src/aidbox";

const HL7_SEGMENTS = new Set([
  "MSH", "PID", "PV1", "PV2", "PD1", "NK1", "ORC", "OBR", "OBX",
  "RXA", "RXR", "SPM", "NTE", "AL1", "DG1", "GT1", "IN1", "IN2",
  "IN3", "TQ1", "TQ2", "SFT", "UAC", "ARV", "PRT", "EVN", "MRG",
  "ROL", "FT1", "ACC", "UB1", "UB2", "RXE", "RXD", "RXG", "RXC",
  "AIG", "AIL", "AIP", "AIS", "SCH", "RGS", "BLG", "ERR", "MSA",
  "QRD", "QRF", "ZDS",
]);

interface ExtractedMessage {
  sourcePath: string;
  message: string;
  type: string;
  sendingApplication?: string;
  sendingFacility?: string;
}

function stripRtf(content: string): string {
  if (!content.startsWith("{\\rtf")) return content;
  return content.replace(/\\[a-z]+-?\d*\s?/g, "").replace(/[{}]/g, "");
}

function extractMessages(raw: string): string[] {
  const content = stripRtf(raw);
  const lines: string[] = [];
  for (const rawLine of content.split(/\r?\n|\r/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const seg = line.split("|")[0]?.trim() ?? "";
    if (HL7_SEGMENTS.has(seg)) lines.push(line);
  }

  const messages: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.startsWith("MSH|")) {
      if (current.length) messages.push(current.join("\r"));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) messages.push(current.join("\r"));
  return messages;
}

function parseMshFields(message: string): {
  type: string;
  sendingApplication?: string;
  sendingFacility?: string;
} {
  const mshLine = message.split(/\r?\n|\r/).find((l) => l.startsWith("MSH"));
  if (!mshLine) return { type: "UNKNOWN" };
  const fields = mshLine.split("|");
  return {
    type: (fields[8] || "UNKNOWN").replace("^", "_"),
    sendingApplication: fields[2] || undefined,
    sendingFacility: fields[3] || undefined,
  };
}

async function* walkFiles(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

async function extractZip(zipPath: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "hl7-batch-"));

  // Platform-specific extraction. Git Bash on Windows ships GNU tar, which
  // cannot read zip archives — fall back to PowerShell's Expand-Archive.
  // On macOS/Linux, `unzip` is near-universal; `tar` (bsdtar) also handles
  // zip and is the best modern default on Windows cmd, but we can't rely on
  // the exact `tar` in PATH, so we dispatch by platform.
  const attempts: Array<{ cmd: string; args: string[] }> = [];
  if (process.platform === "win32") {
    attempts.push({
      cmd: "powershell.exe",
      args: [
        "-NoProfile",
        "-Command",
        `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${dir.replace(/'/g, "''")}' -Force`,
      ],
    });
  } else {
    attempts.push({ cmd: "unzip", args: ["-qq", "-o", zipPath, "-d", dir] });
    attempts.push({ cmd: "tar", args: ["-xf", zipPath, "-C", dir] });
  }

  let lastErr = "";
  for (const { cmd, args } of attempts) {
    const result = spawnSync(cmd, args, { encoding: "utf-8" });
    if (result.status === 0) return dir;
    lastErr = `${cmd}: ${result.stderr || result.stdout || `exit ${result.status}`}`;
  }

  await rm(dir, { recursive: true, force: true });
  throw new Error(`Failed to extract ${zipPath}: ${lastErr}`);
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function parseArgs(argv: string[]): { source: string; tag?: string } {
  const positional: string[] = [];
  let tag: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--tag") {
      tag = argv[++i];
    } else if (arg.startsWith("--tag=")) {
      tag = arg.slice("--tag=".length);
    } else {
      positional.push(arg);
    }
  }
  if (positional.length !== 1) {
    console.error("Usage: bun scripts/import-batch.ts <zip|dir> [--tag <name>]");
    process.exit(2);
  }
  return { source: positional[0]!, tag };
}

async function main(): Promise<void> {
  const { source, tag: explicitTag } = parseArgs(process.argv.slice(2));

  const sourceFile = Bun.file(source);
  const stat = await sourceFile.stat().catch(() => null);
  if (!stat) {
    console.error(`Source not found: ${source}`);
    process.exit(1);
  }

  let scanRoot: string;
  let cleanupDir: string | null = null;
  const isZip = extname(source).toLowerCase() === ".zip";
  if (isZip) {
    scanRoot = await extractZip(source);
    cleanupDir = scanRoot;
    console.log(`Extracted ${source} to ${scanRoot}`);
  } else if (stat.isDirectory()) {
    scanRoot = source;
  } else {
    // Single file.
    scanRoot = source;
  }

  const base = basename(source).replace(/\.zip$/i, "");
  const batchTag =
    explicitTag ?? `${base || "batch"}-${formatTimestamp(new Date())}`;

  const extracted: ExtractedMessage[] = [];
  const readOne = async (filePath: string) => {
    const raw = await Bun.file(filePath).text();
    for (const message of extractMessages(raw)) {
      const msh = parseMshFields(message);
      extracted.push({
        sourcePath: filePath,
        message,
        type: msh.type,
        sendingApplication: msh.sendingApplication,
        sendingFacility: msh.sendingFacility,
      });
    }
  };

  if (stat.isDirectory() || isZip) {
    for await (const file of walkFiles(scanRoot)) {
      await readOne(file);
    }
  } else {
    await readOne(scanRoot);
  }

  console.log(
    `Batch tag: ${batchTag}\nFound ${extracted.length} message(s) across source.`,
  );

  const countsByType = new Map<string, number>();
  let created = 0;
  let failed = 0;
  const now = new Date().toISOString();

  for (const msg of extracted) {
    const resource = {
      resourceType: "IncomingHL7v2Message" as const,
      type: msg.type,
      date: now,
      message: msg.message,
      status: "received" as const,
      batchTag,
      ...(msg.sendingApplication && { sendingApplication: msg.sendingApplication }),
      ...(msg.sendingFacility && { sendingFacility: msg.sendingFacility }),
    };

    try {
      await aidboxFetch("/fhir/IncomingHL7v2Message", {
        method: "POST",
        body: JSON.stringify(resource),
      });
      created++;
      countsByType.set(msg.type, (countsByType.get(msg.type) ?? 0) + 1);
    } catch (err) {
      failed++;
      const sourceHint = relative(scanRoot, msg.sourcePath);
      console.error(
        `  ✗ Failed to create message from ${sourceHint}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  if (cleanupDir) {
    await rm(cleanupDir, { recursive: true, force: true });
  }

  console.log(`\nImported ${created} message(s) as batchTag=${batchTag}`);
  if (failed) console.log(`Failed: ${failed}`);
  if (countsByType.size) {
    console.log("By type:");
    for (const [type, count] of [...countsByType.entries()].sort()) {
      console.log(`  ${type}: ${count}`);
    }
  }
  console.log(
    `\nView the batch at: http://localhost:3000/incoming-messages?batch=${encodeURIComponent(batchTag)}`,
  );

  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
