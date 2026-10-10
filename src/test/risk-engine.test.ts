import { describe, expect, it } from "vitest";
import rows from "../../ml/verification_rows.json";
import { levelForScore } from "@/lib/riskEngine";
import { runMlRiskEngine, type RiskFeatures } from "@/lib/mlRiskEngine";
import { RISK_BANDS, decideRisk } from "@/config/security";

describe("ML risk engine parity with scikit-learn", () => {
  it.each(rows.map((row, i) => [i, row] as const))("row %i matches the Python model", (_, row) => {
    const result = runMlRiskEngine(row.features as RiskFeatures);
    expect(result.attackerProbability).toBeCloseTo(row.expected_attackerProbability, 3);
  });

  it("scores are bounded and bands are consistent with the score", () => {
    for (const row of rows) {
      const r = runMlRiskEngine(row.features as RiskFeatures);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
      expect(r.level).toBe(levelForScore(r.score));
    }
  });
});

describe("risk thresholds", () => {
  it("maps scores to decisions at the band edges", () => {
    expect(decideRisk(0)).toBe("allow");
    expect(decideRisk(30)).toBe("allow");
    expect(decideRisk(31)).toBe("challenge");
    expect(decideRisk(60)).toBe("challenge");
    expect(decideRisk(61)).toBe("trap");
    expect(decideRisk(80)).toBe("trap");
    expect(decideRisk(81)).toBe("block");
    expect(decideRisk(100)).toBe("block");
  });

  it("keeps decideRisk and RISK_BANDS in agreement for every integer score", () => {
    for (let score = 0; score <= 100; score += 1) {
      const band = RISK_BANDS.find((b) => score >= b.min && (b.max === null || score <= b.max));
      expect(band?.decision).toBe(decideRisk(score));
    }
  });
});
