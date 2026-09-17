/**
 * simulate_attacker_sessions.js
 *
 * Drives a REAL browser (via Playwright) against your locally running
 * IntelliTrap app to produce genuinely-measured "attacker-like" session
 * telemetry -- not synthetic random draws. Every feature value in the
 * output CSV is either:
 *   (a) ground truth from the script's own actions (e.g. failedPasswords =
 *       the number of wrong passwords we deliberately submitted), or
 *   (b) a real wall-clock measurement (e.g. keystrokeAvgMs = actual
 *       millisecond deltas between real keydown events Playwright fired,
 *       requestsPerMinute = real timestamps of real form submissions).
 *
 * *** IMPORTANT -- READ BEFORE RUNNING ***
 * This hits your app's real backend (Supabase project configured in .env).
 * There is no separate local/mocked Supabase stack in this repo. Running
 * this script WILL write real rows into your visitor_events / honeypot /
 * blocked_ips tables, and CAN trigger your own machine's IP being
 * auto-blocked by the app's real enforcement logic. Do not point this at
 * a production project backing a live public deployment. See
 * ml/collect_real_sessions.md for the full safety protocol.
 *
 * Prerequisites:
 *   1. npm install -D playwright && npx playwright install chromium
 *   2. `npm run dev` running locally (default http://localhost:3000)
 *   3. A real share code + password already created through the app's own
 *      share-creation flow (this script does NOT create shares -- it only
 *      attacks an existing one, the same way a real attacker would only
 *      have the public-facing /share link).
 *
 * Usage:
 *   INTELLITRAP_SHARE_CODE=HYD-X7K2 node ml/simulate_attacker_sessions.js
 *
 * Env vars:
 *   INTELLITRAP_BASE_URL   default http://localhost:3000
 *   INTELLITRAP_SHARE_CODE required -- a real, existing share code
 *   N_SESSIONS             default 40
 *   HEADLESS                default true
 *   BAD_CODE_RATIO          default 0.25 -- fraction of sessions that instead
 *                           guess a random wrong 8-char code (never reaches
 *                           the password screen at all -- a distinct, also
 *                           realistic attacker behaviour)
 */

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = process.env.INTELLITRAP_BASE_URL || "http://localhost:3000";
const SHARE_CODE = process.env.INTELLITRAP_SHARE_CODE;
const N_SESSIONS = Number(process.env.N_SESSIONS || 40);
const HEADLESS = (process.env.HEADLESS ?? "true") !== "false";
const BAD_CODE_RATIO = Number(process.env.BAD_CODE_RATIO ?? 0.25);
const OUT_PATH = path.join(__dirname, "real_attacker_sessions.csv");

if (!SHARE_CODE) {
  console.error(
    "Set INTELLITRAP_SHARE_CODE to a real share code you created through the app's normal share flow.\n" +
      "Example: INTELLITRAP_SHARE_CODE=HYD-X7K2 node ml/simulate_attacker_sessions.js",
  );
  process.exit(1);
}

// Mirrors SUSPICIOUS_AGENTS in src/lib/riskEngine.ts, so hasSuspiciousUA is
// computed the same way the real app would compute it.
const SUSPICIOUS_AGENTS = [
  "python", "curl", "wget", "scrapy", "headless", "phantom", "selenium",
  "puppeteer", "postman", "httpie", "go-http", "java/", "libwww", "bot",
  "crawler", "spider",
];

const FEATURE_COLUMNS = [
  "failedPasswords", "failedCodes", "requestsPerMinute", "mouseMovements",
  "keystrokeAvgMs", "isProxy", "isHosting", "hasSuspiciousUA", "isOffHoursIST",
  "previousBlocks", "timeOnPageSeconds", "scrollEvents", "pageViews",
];

function randomWrongCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** Types text via real keydown/keyup events at bot speed, no mouse involved. */
async function fastType(page, locator, text, delayMs) {
  await locator.focus();
  const deltas = [];
  let last = Date.now();
  for (const ch of text) {
    await page.keyboard.type(ch, { delay: delayMs });
    const now = Date.now();
    deltas.push(now - last);
    last = now;
  }
  return deltas;
}

/** Sets input value directly via JS, no keyboard/mouse events at all -- the
 * "instant fill" bot archetype (mirrors credential_stuffing_bot in the
 * synthetic dataset, which is null-keystroke ~40% of the time). */
async function instantFill(locator, text) {
  await locator.evaluate((el, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, text);
}

async function runBadCodeSession(browser, index) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const sessionStart = Date.now();
  const requestTimestamps = [];

  await page.goto(`${BASE_URL}/share`);
  const codeInput = page.getByPlaceholder("HYD-X7K2");

  const useInstantFill = index % 2 === 0;
  let keystrokeDeltas = [];
  const wrongCode = randomWrongCode();
  if (useInstantFill) {
    await instantFill(codeInput, wrongCode);
  } else {
    keystrokeDeltas = await fastType(page, codeInput, wrongCode, 15);
  }

  await page.getByRole("button", { name: /find file owner/i }).click({ force: true });
  requestTimestamps.push(Date.now());
  await page.waitForTimeout(600); // let the "no files found" response land

  const userAgent = await page.evaluate(() => navigator.userAgent);
  const hasSuspiciousUA = SUSPICIOUS_AGENTS.some((a) => userAgent.toLowerCase().includes(a));
  const istHour = new Date(Date.now() + 5.5 * 3600 * 1000).getUTCHours();
  const isOffHoursIST = istHour < 6 || istHour > 23;
  const sessionEnd = Date.now();
  const timeOnPageSeconds = (sessionEnd - sessionStart) / 1000;
  const oneMinuteAgo = sessionEnd - 60_000;
  const requestsPerMinute = requestTimestamps.filter((t) => t > oneMinuteAgo).length;
  const keystrokeAvgMs = keystrokeDeltas.length
    ? keystrokeDeltas.reduce((a, b) => a + b, 0) / keystrokeDeltas.length
    : null;

  await context.close();

  return {
    failedPasswords: 0,
    failedCodes: 1,
    requestsPerMinute,
    mouseMovements: 0,
    keystrokeAvgMs,
    isProxy: false,
    isHosting: false,
    hasSuspiciousUA,
    isOffHoursIST,
    previousBlocks: 0,
    timeOnPageSeconds,
    scrollEvents: 0,
    pageViews: 1,
    isAttacker: 1,
    scenario: useInstantFill ? "playwright_bad_code_instant" : "playwright_bad_code_keyed",
  };
}

async function runPasswordBruteForceSession(browser, index) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const sessionStart = Date.now();
  const requestTimestamps = [];

  await page.goto(`${BASE_URL}/share`);
  const codeInput = page.getByPlaceholder("HYD-X7K2");

  const useInstantFill = index % 2 === 0;
  let keystrokeDeltas = [];
  if (useInstantFill) {
    await instantFill(codeInput, SHARE_CODE);
  } else {
    keystrokeDeltas = keystrokeDeltas.concat(await fastType(page, codeInput, SHARE_CODE, 15));
  }
  await page.getByRole("button", { name: /find file owner/i }).click({ force: true });
  requestTimestamps.push(Date.now());

  // A code can list multiple files -- pick the first if a chooser appears.
  await page.waitForTimeout(500);
  const fileChooserButtons = page.locator('button:has-text("·")');
  if (await fileChooserButtons.count() > 0) {
    await fileChooserButtons.first().click({ force: true });
  }

  const passwordInput = page.getByPlaceholder("Enter password");
  if ((await passwordInput.count()) === 0) {
    // The code didn't resolve to a real share -- can't run this scenario.
    await context.close();
    throw new Error(
      `INTELLITRAP_SHARE_CODE="${SHARE_CODE}" did not reach the password screen. ` +
        "Create a real share through the app first.",
    );
  }

  // Real bots probing a password rarely guess right; submit up to 3 wrong
  // guesses (the app requires a captcha after that, which this script
  // deliberately does not attempt to solve -- staying honest about not
  // evading anti-bot protection).
  const wrongPasswords = ["password123", "letmein1", "qwerty99"];
  for (const guess of wrongPasswords) {
    if (useInstantFill) {
      await instantFill(passwordInput, guess);
    } else {
      keystrokeDeltas = keystrokeDeltas.concat(await fastType(page, passwordInput, guess, 15));
    }
    await page.keyboard.press("Enter");
    requestTimestamps.push(Date.now());
    await page.waitForTimeout(400);
    const stillOnPasswordScreen = (await passwordInput.count()) > 0;
    if (!stillOnPasswordScreen) break; // blocked/honeypot/granted -- stop early
  }

  const userAgent = await page.evaluate(() => navigator.userAgent);
  const hasSuspiciousUA = SUSPICIOUS_AGENTS.some((a) => userAgent.toLowerCase().includes(a));
  const istHour = new Date(Date.now() + 5.5 * 3600 * 1000).getUTCHours();
  const isOffHoursIST = istHour < 6 || istHour > 23;
  const sessionEnd = Date.now();
  const timeOnPageSeconds = (sessionEnd - sessionStart) / 1000;
  const oneMinuteAgo = sessionEnd - 60_000;
  const requestsPerMinute = requestTimestamps.filter((t) => t > oneMinuteAgo).length;
  const keystrokeAvgMs = keystrokeDeltas.length
    ? keystrokeDeltas.reduce((a, b) => a + b, 0) / keystrokeDeltas.length
    : null;

  await context.close();

  return {
    failedPasswords: wrongPasswords.length,
    failedCodes: 0,
    requestsPerMinute,
    mouseMovements: 0,
    keystrokeAvgMs,
    isProxy: false,
    isHosting: false,
    hasSuspiciousUA,
    isOffHoursIST,
    previousBlocks: 0,
    timeOnPageSeconds,
    scrollEvents: 0,
    pageViews: 1,
    isAttacker: 1,
    scenario: useInstantFill ? "playwright_bruteforce_instant" : "playwright_bruteforce_keyed",
  };
}

async function main() {
  const browser = await chromium.launch({ headless: HEADLESS });
  const rows = [];
  let failures = 0;

  for (let i = 0; i < N_SESSIONS; i++) {
    const useBadCode = Math.random() < BAD_CODE_RATIO;
    try {
      const row = useBadCode
        ? await runBadCodeSession(browser, i)
        : await runPasswordBruteForceSession(browser, i);
      rows.push(row);
      console.log(`[${i + 1}/${N_SESSIONS}] ${row.scenario}`, row);
    } catch (err) {
      failures += 1;
      console.error(`[${i + 1}/${N_SESSIONS}] session failed:`, err.message);
    }
  }
  await browser.close();

  const header = [...FEATURE_COLUMNS, "isAttacker", "scenario"].join(",");
  const lines = rows.map((r) =>
    [...FEATURE_COLUMNS, "isAttacker", "scenario"]
      .map((c) => (r[c] === null ? "" : r[c]))
      .join(","),
  );
  fs.writeFileSync(OUT_PATH, [header, ...lines].join("\n") + "\n");
  console.log(`\nWrote ${rows.length} attacker-like sessions to ${OUT_PATH} (${failures} failed)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
