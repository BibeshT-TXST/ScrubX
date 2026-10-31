// Downloads the external evaluation sets at pinned revisions and converts them to eval/external/*.jsonl.
// Needs network, so it runs by hand. `npm run eval` only reads the committed output and checks its hash.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../eval/external/", import.meta.url));
const ASQ_COMMIT = "fdb371ce7e3908a945d82f20411546b9876f862e";
const NOTINJECT_REV = "847ae76cf8fea5ed325429e569ae8cfef022d2e0";

const ASQ_TYPES = {
  NAME: "NAME",
  GEOGRAPHIC_LOCATION: "ADDRESS",
  DATE: "DATE",
  MEDICAL_RECORD_NUMBER: "MRN",
  HEALTH_PLAN_BENEFICIARY_NUMBER: "ID",
  PHONE_NUMBER: "PHONE",
  SOCIAL_SECURITY_NUMBER: "SSN",
  EMAIL_ADDRESS: "EMAIL",
  UNIQUE_IDENTIFIER: "ID",
  ACCOUNT_NUMBER: "ID",
  FAX_NUMBER: "FAX",
  CERTIFICATE_LICENSE_NUMBER: "ID",
  IP_ADDRESS: "IP",
};
const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*";
const MONTH_ONLY = new RegExp(`^(?:${MONTH}\\.?,?(?: \\d{4})?|\\d{4} ${MONTH})$`, "i");
// ASQ-PHI's gold sometimes keeps the word in front of the identifier. Neither identifies anyone, so
// leaving them in would score "Dr" as a leak. Applied to every row, not only the ones that failed.
const TITLE = /^(?:dr|mr|mrs|ms)\.?\s+/i;
const FIELD_WORD = /^(?:patient id|site id|medicare|case)\s*[:#]?\s*/i;

async function fetchOk(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res;
}

async function asqPhi() {
  const url = `https://raw.githubusercontent.com/JamesWeatherhead/asq-phi/${ASQ_COMMIT}/data/synthetic_clinical_queries.txt`;
  const source = await (await fetchOk(url)).text();
  return source
    .split("===QUERY===")
    .slice(1)
    .map((block, i) => {
      const [query, tags] = block.split("===PHI_TAGS===");
      const gold = tags
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          const { identifier_type: kind, value: tagged } = JSON.parse(line);
          const type = ASQ_TYPES[kind];
          if (!type) throw new Error(`unmapped ASQ-PHI type ${kind}`);
          const value = tagged.replace(type === "NAME" ? TITLE : FIELD_WORD, "");
          return {
            value,
            type,
            scope: "safe_harbor",
            // ASQ-PHI doesn't say whose name a NAME is. It has no patient record, so "other" is what the detector faces.
            ...(type === "NAME" && { subject: "other" }),
            ...(type === "DATE" && MONTH_ONLY.test(value.trim()) && { monthYear: true }),
          };
        });
      return {
        id: `asq-${String(i + 1).padStart(4, "0")}`,
        stratum: gold.length ? "asq-phi" : "asq-hard-negative",
        shape: "plain",
        text: query.trim(),
        patient: null,
        gold,
      };
    });
}

async function notInject() {
  const rows = [];
  for (const split of ["NotInject_one", "NotInject_two", "NotInject_three"]) {
    const url = `https://datasets-server.huggingface.co/rows?dataset=leolee99%2FNotInject&config=default&split=${split}&offset=0&length=100`;
    for (let offset = 0; ; offset += 100) {
      const page = await (await fetchOk(url.replace("offset=0", `offset=${offset}`))).json();
      rows.push(...page.rows.map((r) => ({ ...r.row, split })));
      if (offset + 100 >= page.num_rows_total) break;
    }
  }
  return rows.map((r, i) => ({
    id: `notinject-${String(i + 1).padStart(3, "0")}`,
    channel: "message",
    label: "benign",
    category: r.category,
    language: r.category === "Multilingual" ? "mixed" : "en",
    text: r.prompt,
  }));
}

const toJsonl = (rows) => `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`;
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

const sets = [
  {
    file: "asq-phi.jsonl",
    kind: "phi",
    name: "ASQ-PHI",
    provenance: `External. Weatherhead, Golovko & McCaffrey (2026), Data in Brief 65, 112586, MIT, commit ${ASQ_COMMIT.slice(0, 7)}. LLM-generated clinical search queries with no patient record, so ScrubX runs without its record lookup. It counts hospitals as geographic locations, which ScrubX does not try to mask, and labels no ages, which ScrubX masks anyway. Titles and field words are stripped from its gold values.`,
    rows: await asqPhi(),
  },
  {
    file: "notinject.jsonl",
    kind: "injection",
    name: "NotInject",
    provenance: `External. Li et al. (2024), InjecGuard, MIT, dataset revision ${NOTINJECT_REV.slice(0, 7)}. All rows are benign, mostly English, and not clinical. It measures over-defense only.`,
    rows: await notInject(),
  },
];

mkdirSync(OUT, { recursive: true });
const sources = sets.map(({ rows, ...meta }) => {
  const text = toJsonl(rows);
  writeFileSync(`${OUT}${meta.file}`, text);
  console.log(`${meta.file}: ${rows.length} rows`);
  return { ...meta, sha256: sha256(text) };
});
writeFileSync(`${OUT}sources.json`, `${JSON.stringify(sources, null, 2)}\n`);
