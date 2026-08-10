import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  behaviorTracker,
  getDeviceFingerprint,
  getSessionToken,
  getVisitorId,
} from "@/lib/tracking/tracker";
import {
  assessVisitorRisk,
  logVisitorEvent,
  markVisitorOffline,
  trackVisitor,
  visitorHeartbeat,
} from "@/lib/tracking/tracking.functions";

type EventType = Parameters<typeof logVisitorEvent>[0] extends { data: infer D }
  ? D extends { event_type: infer E }
    ? E
    : string
  : string;

export type RiskAssessment = {
  score: number;
  level: "low" | "medium" | "high" | "critical";
  decision: "granted" | "captcha_mfa" | "honeypot" | "blocked";
  breakdown: Record<string, number>;
  signals: string[];
};

type TrackingContextValue = {
  sessionToken: string | null;
  visitorId: string | null;
  ipAddress: string | null;
  blocked: boolean;
  ready: boolean;
  logEvent: (type: EventType, data?: Record<string, unknown>) => Promise<void>;
  assessRisk: () => Promise<RiskAssessment | null>;
};

const TrackingContext = createContext<TrackingContextValue | null>(null);

const HEARTBEAT_MS = 15_000;

export function TrackingProvider({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const identity = useRef<{ session: string; visitor: string } | null>(null);

  // Identity + behaviour listeners: browser-only, mounted once.
  useEffect(() => {
    const session = getSessionToken();
    const visitor = getVisitorId();
    identity.current = { session, visitor };
    setSessionToken(session);
    setVisitorId(visitor);
    behaviorTracker.start();
    return () => behaviorTracker.stop();
  }, []);

  // One page-view record per route change.
  useEffect(() => {
    if (!identity.current) return;
    let cancelled = false;
    const { session, visitor } = identity.current;

    void trackVisitor({
      data: {
        session_token: session,
        visitor_id: visitor,
        page: pathname,
        referrer: document.referrer ?? "",
        device: getDeviceFingerprint(),
        behavior: behaviorTracker.snapshot(),
      },
    })
      .then((result) => {
        if (cancelled || !result) return;
        const isBlocked = Boolean(result.blocked);
        setBlocked(isBlocked);
        if ("ip" in result && result.ip) setIpAddress(result.ip);
        if (isBlocked && window.location.pathname !== "/blocked") {
          void navigate({ to: "/blocked" });
        }
      })

      .catch(() => {
        /* tracking must never break the page */
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, sessionToken, navigate]);

  // Heartbeat so the dashboard can tell who is still online.
  useEffect(() => {
    if (!sessionToken || blocked) return;
    const interval = window.setInterval(() => {
      void visitorHeartbeat({
        data: { session_token: sessionToken, page: pathname, behavior: behaviorTracker.snapshot() },
      }).catch(() => {});
    }, HEARTBEAT_MS);
    return () => window.clearInterval(interval);
  }, [sessionToken, pathname, blocked]);

  // Mark the session offline as soon as the tab closes or is hidden, so
  // "online now" never keeps counting people who have left.
  useEffect(() => {
    if (!sessionToken) return;
    const goOffline = () => {
      void markVisitorOffline({ data: { session_token: sessionToken } }).catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") goOffline();
    };
    window.addEventListener("pagehide", goOffline);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", goOffline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [sessionToken]);

  const logEvent = useCallback(async (type: EventType, data: Record<string, unknown> = {}) => {
    if (!identity.current) return;
    try {
      await logVisitorEvent({
        data: {
          session_token: identity.current.session,
          visitor_id: identity.current.visitor,
          event_type: type,
          page_path: window.location.pathname,
          event_data: data,
        },
      });
    } catch {
      /* non-critical */
    }
  }, []);

  const assessRisk = useCallback(async (): Promise<RiskAssessment | null> => {
    if (!identity.current) return null;
    try {
      const result = await assessVisitorRisk({
        data: { session_token: identity.current.session },
      });
      if (!result || "error" in result) return null;
      return result as RiskAssessment;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo<TrackingContextValue>(
    () => ({ sessionToken, visitorId, ipAddress, blocked, ready, logEvent, assessRisk }),
    [sessionToken, visitorId, ipAddress, blocked, ready, logEvent, assessRisk],
  );

  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>;
}

export function useTracking(): TrackingContextValue {
  const context = useContext(TrackingContext);
  if (!context) throw new Error("useTracking must be used inside TrackingProvider");
  return context;
}
