/**
 * browser_console_logger.js
 *
 * Paste this into your browser's DevTools console on the app's /share page
 * BEFORE you start interacting, to log one real "legitimate" session for
 * ml/real_legitimate_sessions.csv (see ml/collect_real_sessions.md for the
 * full protocol).
 *
 * It mirrors the exact counting logic of the app's own behaviour tracker
 * (src/lib/tracking/tracker.ts's BehaviorTracker class) -- same events,
 * same keystroke-interval averaging -- run as an independent listener so it
 * doesn't depend on reaching into the app's internal module state.
 *
 * failedPasswords/failedCodes are self-reported (you know how many times
 * you mistyped) -- pass them into __intellitrapLogSession() when you're done.
 */
(function () {
  const start = Date.now();
  let mouseMovements = 0;
  let keystrokes = 0;
  const keystrokeIntervals = [];
  let lastKeyTime = 0;
  let scrolls = 0;

  function onMouse() {
    mouseMovements += 1;
  }
  function onKey() {
    keystrokes += 1;
    const now = performance.now();
    if (lastKeyTime) keystrokeIntervals.push(now - lastKeyTime);
    lastKeyTime = now;
  }
  function onScroll() {
    scrolls += 1;
  }

  window.addEventListener("mousemove", onMouse, { passive: true });
  window.addEventListener("keydown", onKey, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });

  window.__intellitrapLogSession = function (opts) {
    opts = opts || {};
    const failedPasswords = opts.failedPasswords ?? 0;
    const failedCodes = opts.failedCodes ?? 0;
    const avgKeystrokeMs = keystrokeIntervals.length
      ? Math.round(keystrokeIntervals.reduce((a, b) => a + b, 0) / keystrokeIntervals.length)
      : "";
    const timeOnPageSeconds = Math.round((Date.now() - start) / 1000);
    const istHour = new Date(Date.now() + 5.5 * 3600 * 1000).getUTCHours();
    const isOffHoursIST = istHour < 6 || istHour > 23;
    // One request per form submission: the final successful one plus any
    // failed code/password attempts along the way.
    const requestsPerMinute = opts.requestsPerMinute ?? 1 + failedPasswords + failedCodes;

    const row = [
      failedPasswords,
      failedCodes,
      requestsPerMinute,
      mouseMovements,
      avgKeystrokeMs,
      false, // isProxy -- see note in collect_real_sessions.md on why this is always false here
      false, // isHosting
      false, // hasSuspiciousUA (real browser)
      isOffHoursIST,
      0, // previousBlocks
      timeOnPageSeconds,
      scrolls,
      1, // pageViews
      0, // isAttacker -- this is the legitimate class
      "human_manual",
    ].join(",");

    console.log("%cCopy this line into ml/real_legitimate_sessions.csv:", "font-weight:bold;color:#22c55e");
    console.log(row);
    return row;
  };

  console.log(
    "IntelliTrap session logger active. Browse normally (find your code, enter the " +
      "password, download the file), then in this console run:\n" +
      "  window.__intellitrapLogSession({ failedPasswords: 0, failedCodes: 0 })\n" +
      "(fill in how many times you actually mistyped, if any) and copy the printed line.",
  );
})();
