import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { z } from "zod";
import { normalizeText } from "../src/core/text/normalize";
import { chartFiles } from "./charts";
import { compareResults } from "./gate";
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
const RESULTS_FILE = path("results.json");
const CHARTS_DIR = path("../docs/eval/");

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
  if (existsSync(RESULTS_FILE) && !reason) fail("results.json exists, so these rows have been scored. Re-freezing needs --reason.");
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

function writeCharts(results: Results) {
  mkdirSync(CHARTS_DIR, { recursive: true });
  for (const [name, contents] of Object.entries(chartFiles(results))) writeFileSync(`${CHARTS_DIR}${name}`, contents);
  console.error(`Wrote charts and the CSV to docs/eval/.`);
}

const committedResults = (): Results | null => (existsSync(RESULTS_FILE) ? JSON.parse(readFileSync(RESULTS_FILE, "utf8")) : null);

async function scoreAll(externalOnly: boolean, accepted: Results["accepted"]): Promise<Results> {
  return {
    commit: git("rev-parse", "--short", "HEAD"),
    accepted,
    own: externalOnly ? null : await scoreOwn(requireFrozen()),
    external: await scoreExternal(),
  };
}

const describeRegressions = (regressions: readonly string[]) =>
  `${regressions.length} item(s) got worse than the committed results:\n${regressions.map((line) => `  ${line}`).join("\n")}`;

/** Generated files must be exactly what results.json produces, or a chart could say something the data doesn't. */
function generatedDrift(results: Results): string[] {
  const expected: [string, string][] = [
    [path("RESULTS.md"), `${renderResults(results)}\n`],
    ...Object.entries(chartFiles(results)).map(([name, contents]): [string, string] => [`${CHARTS_DIR}${name}`, contents]),
  ];
  return expected.filter(([file, contents]) => !existsSync(file) || readFileSync(file, "utf8") !== contents).map(([file]) => file);
}

/** The CI gate. Scores everything and compares each item to what is committed, with no margin. */
function check(now: Results) {
  const base = committedResults() ?? fail("no results.json to compare to. Run --write first.");
  const { regressions, improvements, dataChanged, outOfDate } = compareResults(base, now);
  if (regressions.length) fail(`${describeRegressions(regressions)}\n\nFix them, or accept them on purpose with --write --accept "why".`);
  if (dataChanged.length) fail(`the rows changed in: ${dataChanged.join(", ")}. Run --write and commit.`);
  if (improvements.length) fail(`${improvements.length} item(s) got better:\n${improvements.map((line) => `  ${line}`).join("\n")}\n\nRun --write and commit, so the results show it.`);
  if (outOfDate) fail("results.json is out of date, though no item got worse. Run --write and commit.");
  const drift = generatedDrift(base);
  if (drift.length) fail(`these don't match results.json. Run --charts or --write, and don't edit them by hand:\n${drift.join("\n")}`);
  console.log("Eval gate passed: no regression on these items. The known failures in eval/RESULTS.md are still there.");
}

async function main() {
  const { values } = parseArgs({
    options: {
      validate: { type: "boolean", default: false },
      freeze: { type: "boolean", default: false },
      external: { type: "boolean", default: false },
      write: { type: "boolean", default: false },
      charts: { type: "boolean", default: false },
      check: { type: "boolean", default: false },
      accept: { type: "string" },
      author: { type: "string" },
      reason: { type: "string" },
    },
  });

  if (values.validate) return void validate();
  if (values.freeze) return freeze(values.author, values.reason);
  if (values.charts) {
    if (!existsSync(RESULTS_FILE)) fail("no results.json. Run --write first.");
    return writeCharts(JSON.parse(readFileSync(RESULTS_FILE, "utf8")));
  }
  if (values.check) return check(await scoreAll(false, committedResults()?.accepted ?? []));
  if (values.write && values.external) fail("--write needs the full run, not --external.");
  if (values.write && uncommitted("src/core")) fail("commit src/core first, so the results describe a real commit.");

  const base = committedResults();
  const results = await scoreAll(values.external, base?.accepted ?? []);
  if (values.write) {
    const regressions = base ? compareResults(base, results).regressions : [];
    if (regressions.length && !values.accept) fail(`${describeRegressions(regressions)}\n\nFix them, or accept them on purpose with --write --accept "why".`);
    if (values.accept && !regressions.length) fail("--accept was given, but nothing got worse.");
    if (values.accept) results.accepted = [...results.accepted, { commit: results.commit, reason: values.accept, items: regressions }];
  }
  const markdown = renderResults(results);
  console.log(markdown);
  if (values.write) {
    writeFileSync(RESULTS_FILE, `${JSON.stringify(results, null, 2)}\n`);
    writeFileSync(path("RESULTS.md"), `${markdown}\n`);
    writeCharts(results);
  }
}

await main();
