import { describe, expect, it } from "vitest";
import type { InjectionScan } from "@/core/injection/scanner";
import { RiskEngine } from "@/core/stages/RiskEngine";
import type { Finding, PhiLabel } from "@/core/types";
import { config, ctx } from "../helpers";

function scan(score: number): InjectionScan {
  return {
    score,
    signals: { role_override: 0, instruction_smuggling: score, exfiltration: 0, encoded_payload: 0, obfuscation: 0 },
    hits: [],
  };
}

const rule = (ruleId: string, severity: Finding["severity"]): Finding => ({
  ruleId,
  severity,
  category: "injection",
  start: 0,
  end: 1,
});

const lotsOfPhi: PhiLabel[] = Array.from({ length: 10 }, (_, i) => ({
  type: "PATIENT",
  start: i,
  end: i + 1,
  confidence: 1,
  source: "record",
}));

async function decide(findings: Finding[], score: number, c = ctx()) {
  return (await new RiskEngine().run({ findings, scan: scan(score), labels: [] }, c)).output;
}

describe("RiskEngine thresholds", () => {
  it.each([
    [0, "allow"],
    [0.39, "allow"],
    [0.4, "flag"],
    [0.79, "flag"],
    [0.8, "block"],
  ])("semantic score %s → %s", async (score, action) => {
    expect((await decide([], score)).action).toBe(action);
  });

  it("blocks on any critical rule regardless of score", async () => {
    const d = await decide([rule("INJ-OVERRIDE", "critical")], 0);
    expect(d.action).toBe("block");
    expect(d.reasons[0]).toBe("Critical rule INJ-OVERRIDE matched: Instruction override");
  });

  it("combines regex hits with noisy-OR but takes the max against the semantic score", async () => {
    // Two high rules: 1 - 0.4 * 0.4 = 0.84
    expect((await decide([rule("INJ-PERSONA", "high"), rule("INJ-SSN-REQUEST", "high")], 0.6)).score).toBe(0.84);
    // Same phrase seen by both detectors is not double counted.
    expect((await decide([rule("INJ-PERSONA", "high")], 0.6)).score).toBe(0.6);
  });

  it("counts a rule once no matter how many times it matched", async () => {
    const d = await decide([rule("INJ-CROSS-PATIENT", "medium"), rule("INJ-CROSS-PATIENT", "medium")], 0);
    expect(d.score).toBe(0.3);
    expect(d.contributions).toEqual([{ source: "rule:INJ-CROSS-PATIENT", score: 0.3 }]);
  });

  it("never treats PHI as risk", async () => {
    const { output } = await new RiskEngine().run({ findings: [], scan: scan(0), labels: lotsOfPhi }, ctx());
    expect(output).toMatchObject({ action: "allow", score: 0, reasons: ["No injection signals detected"] });
  });

  it("reads thresholds from config", async () => {
    const strict = ctx({ config: config({ RISK_BLOCK_THRESHOLD: "0.5", RISK_FLAG_THRESHOLD: "0.2" }) });
    expect((await decide([], 0.5, strict)).action).toBe("block");
    expect((await decide([], 0.3, strict)).action).toBe("flag");
  });

  it("marks a blocked span and generates the caption from the decision", async () => {
    const { span } = await new RiskEngine().run({ findings: [], scan: scan(0.9), labels: [] }, ctx());
    expect(span.status).toBe("blocked");
    expect(span.caption).toBe("Risk engine sees 1 injection signal and blocks it.");
  });
});
