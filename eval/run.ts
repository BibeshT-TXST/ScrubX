import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { z } from "zod";
import { normalizeText } from "../src/core/text/normalize";
import { observeInjectionRow, observePhiRow } from "./harness";
import { renderResults, type Results, type SetResult } from "./report";
import { InjectionRowSchema, parseJsonl, PhiRowSchema, type InjectionRow, type PhiRow } from "./schema";
import {
  resolveGold,
  scoreInjectionRow,
  scorePhiRow,
  summarizeInjection,
  summarizePhi,
  type InjectionSummary,
  type PhiSummary,
} from "./score";

const path = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const ROOT = path("..");
const PHI_FILE = path("phi.jsonl");
const INJECTION_FILE = path("injection.jsonl");
const LOCK_FILE = path("dataset.lock.json");
const SOURCES_FILE = path("external/sources.json");

// The issue's minimum for each file.
const MIN_PHI_ROWS = 200;
const MIN_INJECTION_ROWS = 150;

interface Lock {
  author: string;
  /** Git tree of src/core at the first freeze. Later runs compare to it to say whether scores are untuned. */
  coreTree: string;
  files: Record<"phi" | "injection", { sha256: string; rows: number }>;
  changes: string[];
}

interface ExternalSource {
  file: string;
  kind: "phi" | "injection";
  name: string;
  sha256: string;
  provenance: string;
}

const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const uncommitted = (...paths: string[]) => git("status", "--porcelain", "--", ...paths);
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

function fail(message: string): never {
  console.error(`eval: ${message}`);
  process.exit(1);
}

function read<T>(file: string, schema: z.ZodType<T>): { text: string; rows: T[] } {
  if (!existsSync(file)) fail(`${file} does not exist. See eval/README.md.`);
  const text = readFileSync(file, "utf8");
  return { text, rows: parseJsonl(text, schema, file) };
}

/** Our own gold has to resolve: a value that isn't in the text is a data error, not a miss. */
function checkOwnGold(rows: readonly PhiRow[]): string[] {
  return rows.flatMap((row) => {
    const text = normalizeText(row.text).text;
    return row.gold.filter((g) => !resolveGold(text, g).length).map((g) => `${row.id}: gold value not found: ${JSON.stringify(g.value)}`);
  });
}

const tally = <T>(rows: readonly T[], key: (r: T) => string) => {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(key(r), (counts.get(key(r)) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `  ${k}: ${n}`).join("\n");
};

/** Runs no detector, so it is safe to use while rows are still being written and reviewed. */
function validate() {
  const phi = read(PHI_FILE, PhiRowSchema);
  const injection = read(INJECTION_FILE, InjectionRowSchema);
  const problems = checkOwnGold(phi.rows);
  if (phi.rows.length < MIN_PHI_ROWS) problems.push(`phi.jsonl has ${phi.rows.length} rows, needs ${MIN_PHI_ROWS}`);
  if (injection.rows.length < MIN_INJECTION_ROWS) problems.push(`injection.jsonl has ${injection.rows.length} rows, needs ${MIN_INJECTION_ROWS}`);
  console.log(`PHI rows by stratum:\n${tally(phi.rows, (r) => r.stratum)}`);
  console.log(`Gold by type:\n${tally(phi.rows.flatMap((r) => r.gold), (g) => g.type)}`);
  console.log(`Injection rows:\n${tally(injection.rows, (r) => `${r.channel} ${r.label}`)}`);
  if (problems.length) fail(`${problems.length} problem(s):\n${problems.join("\n")}`);
  console.log("Valid. No detector was run.");
  return { phi, injection };
}

function freeze(author: string | undefined, reason: string | undefined) {
  const { phi, injection } = validate();
  const previous: Lock | null = existsSync(LOCK_FILE) ? JSON.parse(readFileSync(LOCK_FILE, "utf8")) : null;
  // Changing labels after seeing a score can only flatter it, so it has to be stated.
  if (existsSync(path("results.json")) && !reason) fail("results.json exists, so these rows have been scored. Re-freezing needs --reason.");
  const lock: Lock = {
    author: author ?? previous?.author ?? fail('freezing needs --author "who wrote the rows"'),
    coreTree: previous?.coreTree ?? git("rev-parse", "HEAD:src/core"),
    files: {
      phi: { sha256: sha256(phi.text), rows: phi.rows.length },
      injection: { sha256: sha256(injection.text), rows: injection.rows.length },
    },
    changes: [...(previous?.changes ?? []), ...(reason ? [reason] : [])],
  };
  writeFileSync(LOCK_FILE, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`Wrote ${LOCK_FILE}. Commit it with the rows BEFORE the first scored run.`);
}

/** The commit that holds the lock has to predate the score, or the hash proves nothing. */
function requireFrozen(): Lock {
  if (!existsSync(LOCK_FILE)) fail("no dataset.lock.json. Run --validate, then --freeze, and commit before scoring.");
  const lock: Lock = JSON.parse(readFileSync(LOCK_FILE, "utf8"));
  const dirty = uncommitted("eval/dataset.lock.json", "eval/phi.jsonl", "eval/injection.jsonl");
  if (dirty) fail(`commit the frozen set before scoring it:\n${dirty}`);
  if (sha256(readFileSync(PHI_FILE, "utf8")) !== lock.files.phi.sha256) fail("phi.jsonl does not match the lock.");
  if (sha256(readFileSync(INJECTION_FILE, "utf8")) !== lock.files.injection.sha256) fail("injection.jsonl does not match the lock.");
  return lock;
}

async function scorePhi(rows: readonly PhiRow[]): Promise<PhiSummary> {
  const results = [];
  for (const row of rows) results.push(scorePhiRow(row, await observePhiRow(row)));
  return summarizePhi(results);
}

async function scoreInjection(rows: readonly InjectionRow[]): Promise<InjectionSummary> {
  const results = [];
  for (const row of rows) results.push(scoreInjectionRow(row, await observeInjectionRow(row)));
  return summarizeInjection(results);
}

async function scoreExternal(): Promise<Results["external"]> {
  const out: Results["external"] = { phi: [], injection: [] };
  if (!existsSync(SOURCES_FILE)) return out;
  const sources: ExternalSource[] = JSON.parse(readFileSync(SOURCES_FILE, "utf8"));
  for (const source of sources) {
    const file = path(`external/${source.file}`);
    const meta = { name: source.name, sha256: source.sha256, provenance: source.provenance };
    if (sha256(readFileSync(file, "utf8")) !== source.sha256) fail(`${source.file} does not match sources.json.`);
    if (source.kind === "phi") {
      const result: SetResult<PhiSummary> = { ...meta, summary: await scorePhi(read(file, PhiRowSchema).rows) };
      out.phi.push(result);
    } else {
      out.injection.push({ ...meta, summary: await scoreInjection(read(file, InjectionRowSchema).rows) });
    }
  }
  return out;
}

async function scoreOwn(lock: Lock): Promise<NonNullable<Results["own"]>> {
  const provenance = `Written by ${lock.author}, from the written plan in eval/AUTHORING_PROMPT.md.`;
  return {
    author: lock.author,
    untuned: git("rev-parse", "HEAD:src/core") === lock.coreTree && !uncommitted("src/core"),
    changes: lock.changes,
    phi: {
      name: "PHI",
      sha256: lock.files.phi.sha256,
      provenance,
      summary: await scorePhi(read(PHI_FILE, PhiRowSchema).rows),
    },
    injection: {
      name: "Prompt injection",
      sha256: lock.files.injection.sha256,
      provenance,
      summary: await scoreInjection(read(INJECTION_FILE, InjectionRowSchema).rows),
    },
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      validate: { type: "boolean", default: false },
      freeze: { type: "boolean", default: false },
      external: { type: "boolean", default: false },
      write: { type: "boolean", default: false },
      author: { type: "string" },
      reason: { type: "string" },
    },
  });

  if (values.validate) return void validate();
  if (values.freeze) return freeze(values.author, values.reason);
  if (values.write && values.external) fail("--write needs the full run, not --external.");
  if (values.write && uncommitted("src/core")) fail("commit src/core first, so the results describe a real commit.");

  const results: Results = {
    commit: git("rev-parse", "--short", "HEAD"),
    own: values.external ? null : await scoreOwn(requireFrozen()),
    external: await scoreExternal(),
  };
  const markdown = renderResults(results);
  console.log(markdown);
  if (values.write) {
    writeFileSync(path("results.json"), `${JSON.stringify(results, null, 2)}\n`);
    writeFileSync(path("RESULTS.md"), `${markdown}\n`);
  }
}

await main();
