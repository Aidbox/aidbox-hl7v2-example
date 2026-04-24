import { readFileSync } from "node:fs";

const text = readFileSync("lint.out", "utf8");
const lines = text.split(/\r?\n/);

const stats: Record<string, number> = {};
const byRule: Record<string, number> = {};
const byDir: Record<string, number> = {};

let current: string | null = null;
for (const line of lines) {
  if (/^C:\\/.test(line)) {
    current = line.trim().replace(/\\/g, "/");
    continue;
  }
  if (!line.includes("warning")) {continue;}
  const parts = line.trim().split(/\s+/);
  const rule = parts[parts.length - 1];
  if (!rule || !/^(@typescript|max-lines|prefer-for-of)/.test(rule)) {continue;}

  let d = "other";
  if (current?.includes("/test/")) {d = "test";}
  else if (current?.includes("/src/")) {d = "src";}
  else if (current?.includes("/scripts/")) {d = "scripts";}

  const k = `${d}|${rule}`;
  stats[k] = (stats[k] ?? 0) + 1;
  byRule[rule] = (byRule[rule] ?? 0) + 1;
  byDir[d] = (byDir[d] ?? 0) + 1;
}

console.log("=== By rule ===");
for (const [r, n] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) {
  console.log(String(n).padStart(5) + "  " + r);
}
console.log("\n=== By dir ===");
for (const [d, n] of Object.entries(byDir).sort((a, b) => b[1] - a[1])) {
  console.log(String(n).padStart(5) + "  " + d);
}
console.log("\n=== By dir x rule ===");
for (const [k, n] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
  console.log(String(n).padStart(5) + "  " + k);
}
