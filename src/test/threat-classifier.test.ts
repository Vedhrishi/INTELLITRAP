import { describe, expect, it } from "vitest";
import corpus from "../../ml/threat_corpus.json";
import { classifyPayload, classifyUpload } from "@/lib/threatClassifier";

describe("threatClassifier corpus", () => {
  it("classifies payloads and prints per-class counts", () => {
    const cats = ["sql_injection", "xss", "path_traversal", "command_injection", "none"];
    const tp: Record<string, number> = {};
    const fp: Record<string, number> = {};
    const fn: Record<string, number> = {};
    for (const c of cats) tp[c] = fp[c] = fn[c] = 0;
    const miss: string[] = [];
    let correct = 0;
    for (const row of corpus.payloads) {
      const got = classifyPayload(row.text).category;
      if (got === row.label) {
        correct++;
        tp[got] = (tp[got] ?? 0) + 1;
      } else {
        fp[got] = (fp[got] ?? 0) + 1;
        fn[row.label] = (fn[row.label] ?? 0) + 1;
        miss.push(`${row.label} -> ${got}: ${row.text}`);
      }
    }
    console.log(
      "PAYLOAD " + JSON.stringify({ n: corpus.payloads.length, correct, tp, fp, fn, miss }),
    );
    expect(correct / corpus.payloads.length).toBeGreaterThan(0.9);
  });

  it("classifies uploads", () => {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    let tn = 0;
    const miss: string[] = [];
    for (const row of corpus.uploads) {
      const head = "head" in row ? new Uint8Array(row.head as number[]) : undefined;
      const got = classifyUpload({ name: row.name, type: row.type }, head).category;
      const positive = row.label === "malicious_upload";
      if (positive && got !== "none") tp++;
      else if (positive) {
        fn++;
        miss.push("FN " + row.name);
      } else if (got !== "none") {
        fp++;
        miss.push("FP " + row.name);
      } else tn++;
    }
    console.log("UPLOAD " + JSON.stringify({ n: corpus.uploads.length, tp, fp, fn, tn, miss }));
    expect(fp).toBe(0);
  });
});
