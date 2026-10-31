import type { Results } from "./report";
import type { InjectionSummary, PhiSummary } from "./score";

// Same rows and same code give the same result, so any difference is a real change. That is why
// there is no margin: a margin allows for sampling noise, and "may drop 1 point" on 300 mentions
// would let 3 new leaks through. Compilers and browsers gate this way (GCC's test comparison,
// web-platform-tests), and ML tools mostly don't.

/** What can happen to one item, from fine to worst. */
interface Item {
  level: number;
  /** Names the levels. Without it the level is a count. */
  names?: readonly string[];
}

type Items = Map<string, Item>;

const ATTACK = ["blocked", "flagged", "allowed"] as const;
const HARMLESS = ["allowed", "flagged", "blocked"] as const;
const RECORD_ATTACK = ["removed", "reached the model"] as const;
const RECORD_HARMLESS = ["kept", "removed"] as const;

function phiItems(set: string, s: PhiSummary): Items {
  const items: Items = new Map();
  const add = (key: string) => {
    const full = `${set}: ${key}`;
    items.set(full, { level: (items.get(full)?.level ?? 0) + 1 });
  };
  for (const m of s.misses) add(`missed in ${m.rowId} ${JSON.stringify(m.value)} (${m.type})`);
  // Counted on every row, or recall could be bought by masking everything.
  for (const l of s.falseLabels) add(`labeled ${l.type} on no PHI in ${l.rowId}`);
  for (const m of s.wrongPersonMentions) add(`third party labeled as the patient in ${m.rowId} ${JSON.stringify(m.value)}`);
  return items;
}

function injectionItems(set: string, s: InjectionSummary): Items {
  const items: Items = new Map();
  const add = (kind: string, ids: readonly string[], level: number, names: readonly string[]) => {
    for (const id of ids) items.set(`${set}: ${kind} ${id}`, { level, names });
  };
  add("attack", s.flaggedAttacks, 1, ATTACK);
  add("attack", s.missedAttacks, 2, ATTACK);
  add("harmless message", s.falseFlags, 1, HARMLESS);
  add("harmless message", s.falseBlocks, 2, HARMLESS);
  add("record attack", s.missedRecordAttacks, 1, RECORD_ATTACK);
  add("harmless record text", s.falseQuarantines, 1, RECORD_HARMLESS);
  return items;
}

interface Sets {
  phi: { name: string; sha256: string; summary: PhiSummary }[];
  injection: { name: string; sha256: string; summary: InjectionSummary }[];
}

function sets(r: Results): Sets {
  return {
    phi: [...(r.own ? [r.own.phi] : []), ...r.external.phi],
    injection: [...(r.own ? [r.own.injection] : []), ...r.external.injection],
  };
}

const levelName = (item: Item | undefined, names: readonly string[] | undefined) => {
  const level = item?.level ?? 0;
  return names?.[level] ?? String(level);
};

export interface Comparison {
  /** Items that got worse. */
  regressions: string[];
  /** Items that got better. */
  improvements: string[];
  /** Sets whose rows differ, so their items can't be compared. */
  dataChanged: string[];
  /** Anything at all differs from what is committed, including label types and the untuned flag. */
  outOfDate: boolean;
}

// Everything that describes the run except when it happened and what was accepted along the way.
const comparable = ({ commit: _commit, accepted: _accepted, ...rest }: Results) => JSON.stringify(rest);

export function compareResults(base: Results, now: Results): Comparison {
  const out: Comparison = { regressions: [], improvements: [], dataChanged: [], outOfDate: comparable(base) !== comparable(now) };
  const compare = <T extends { name: string; sha256: string; summary: unknown }>(
    before: readonly T[],
    after: readonly T[],
    items: (set: string, summary: T["summary"]) => Items,
  ) => {
    for (const set of after) {
      const old = before.find((b) => b.name === set.name);
      if (old?.sha256 !== set.sha256) {
        out.dataChanged.push(set.name);
        continue;
      }
      const a = items(old.name, old.summary);
      const b = items(set.name, set.summary);
      for (const key of new Set([...a.keys(), ...b.keys()])) {
        const was = a.get(key);
        const is = b.get(key);
        const names = was?.names ?? is?.names;
        const line = `${key}: ${levelName(was, names)} -> ${levelName(is, names)}`;
        if ((is?.level ?? 0) > (was?.level ?? 0)) out.regressions.push(line);
        if ((is?.level ?? 0) < (was?.level ?? 0)) out.improvements.push(line);
      }
    }
  };
  const before = sets(base);
  const after = sets(now);
  compare(before.phi, after.phi, (name, s) => phiItems(name, s as PhiSummary));
  compare(before.injection, after.injection, (name, s) => injectionItems(name, s as InjectionSummary));
  return out;
}
