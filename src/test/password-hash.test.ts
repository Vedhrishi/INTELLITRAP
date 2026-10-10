import { describe, expect, it } from "vitest";
import {
  hashSharePasswordV2,
  legacySha256,
  needsRehash,
  verifySharePassword,
} from "@/lib/share/password-hash";

describe("share password hashing", () => {
  it("round-trips and uses a fresh salt each time", async () => {
    const a = await hashSharePasswordV2("correct horse");
    const b = await hashSharePasswordV2("correct horse");
    expect(a).not.toBe(b);
    expect(await verifySharePassword("correct horse", a)).toBe(true);
    expect(await verifySharePassword("wrong", a)).toBe(false);
    expect(needsRehash(a)).toBe(false);
  });

  it("still verifies legacy SHA-256 hashes and flags them for upgrade", async () => {
    const legacy = await legacySha256("old-pass");
    expect(await verifySharePassword("old-pass", legacy)).toBe(true);
    expect(await verifySharePassword("nope", legacy)).toBe(false);
    expect(needsRehash(legacy)).toBe(true);
  });

  it("rejects malformed stored values instead of throwing", async () => {
    expect(await verifySharePassword("x", "pbkdf2$abc$zz$12")).toBe(false);
    expect(await verifySharePassword("x", "pbkdf2$100000$$")).toBe(false);
  });
});
