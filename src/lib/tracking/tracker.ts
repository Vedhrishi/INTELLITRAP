import { UAParser } from "ua-parser-js";

const SESSION_KEY = "it_session_v2";
const VISITOR_KEY = "it_visitor_v2";

export function getSessionToken(): string {
  let value = sessionStorage.getItem(SESSION_KEY);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, value);
  }
  return value;
}

export function getVisitorId(): string {
  let value = localStorage.getItem(VISITOR_KEY);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, value);
  }
  return value;
}

export type DeviceFingerprint = ReturnType<typeof getDeviceFingerprint>;

export function getDeviceFingerprint() {
  const result = new UAParser(navigator.userAgent).getResult();
  return {
    userAgent: navigator.userAgent.slice(0, 1000),
    browser: result.browser.name ?? "Unknown",
    browserVersion: result.browser.version ?? "",
    os: result.os.name ?? "Unknown",
    osVersion: result.os.version ?? "",
    deviceType: result.device.type ?? "desktop",
    vendor: result.device.vendor ?? "",
    screen: `${screen.width}x${screen.height}`,
    colorDepth: screen.colorDepth,
    tzOffset: new Date().getTimezoneOffset(),
    language: navigator.language,
    languages: Array.from(navigator.languages ?? []).slice(0, 20),
    cores: navigator.hardwareConcurrency ?? 0,
    memory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 0,
    touch: "ontouchstart" in window,
  };
}

export type BehaviorSnapshot = {
  mouseMovements: number;
  mouseDistance: number;
  keystrokes: number;
  avgKeystrokeMs: number | null;
  clicks: number;
  scrolls: number;
  copies: number;
  tabSwitches: number;
  timeOnSite: number;
};

/**
 * Passive behavioural telemetry. Counters only — no key contents are captured.
 * Every listener added in start() is removed in stop().
 */
class BehaviorTracker {
  private mouseMovements = 0;
  private mouseDistance = 0;
  private keystrokes = 0;
  private keystrokeIntervals: number[] = [];
  private clicks = 0;
  private scrolls = 0;
  private copies = 0;
  private tabSwitches = 0;
  private startTime = Date.now();
  private lastX: number | null = null;
  private lastY: number | null = null;
  private lastKeyTime = 0;
  private started = false;

  private onMouse = (event: MouseEvent) => {
    this.mouseMovements += 1;
    if (this.lastX !== null && this.lastY !== null) {
      this.mouseDistance += Math.hypot(event.clientX - this.lastX, event.clientY - this.lastY);
    }
    this.lastX = event.clientX;
    this.lastY = event.clientY;
  };

  private onKey = () => {
    this.keystrokes += 1;
    const now = performance.now();
    if (this.lastKeyTime) this.keystrokeIntervals.push(now - this.lastKeyTime);
    this.lastKeyTime = now;
  };

  private onClick = () => {
    this.clicks += 1;
  };

  private onScroll = () => {
    this.scrolls += 1;
  };

  private onCopy = () => {
    this.copies += 1;
  };

  private onVisibility = () => {
    if (document.visibilityState === "hidden") this.tabSwitches += 1;
  };

  start() {
    if (this.started) return;
    this.started = true;
    window.addEventListener("mousemove", this.onMouse, { passive: true });
    window.addEventListener("keydown", this.onKey, { passive: true });
    window.addEventListener("click", this.onClick, { passive: true });
    window.addEventListener("scroll", this.onScroll, { passive: true });
    document.addEventListener("copy", this.onCopy);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    window.removeEventListener("mousemove", this.onMouse);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("click", this.onClick);
    window.removeEventListener("scroll", this.onScroll);
    document.removeEventListener("copy", this.onCopy);
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  snapshot(): BehaviorSnapshot {
    const intervals = this.keystrokeIntervals;
    const avg =
      intervals.length > 0
        ? Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length)
        : null;
    return {
      mouseMovements: this.mouseMovements,
      mouseDistance: Math.round(this.mouseDistance),
      keystrokes: this.keystrokes,
      avgKeystrokeMs: avg,
      clicks: this.clicks,
      scrolls: this.scrolls,
      copies: this.copies,
      tabSwitches: this.tabSwitches,
      timeOnSite: Math.round((Date.now() - this.startTime) / 1000),
    };
  }
}

export const behaviorTracker = new BehaviorTracker();
