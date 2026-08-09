import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const WARN_AFTER_MS = 25 * 60 * 1000;
const SIGN_OUT_AFTER_MS = 30 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click"] as const;

/** Signs the user out after 30 minutes of inactivity, warning at 25. */
export function SessionTimeout() {
  const navigate = useNavigate();
  const lastActivity = useRef(Date.now());
  const [showWarning, setShowWarning] = useState(false);

  const resetActivity = useCallback(() => {
    lastActivity.current = Date.now();
  }, []);

  useEffect(() => {
    const handleActivity = () => {
      lastActivity.current = Date.now();
    };
    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, handleActivity);
    }

    const interval = window.setInterval(() => {
      const idleFor = Date.now() - lastActivity.current;
      if (idleFor >= SIGN_OUT_AFTER_MS) {
        setShowWarning(false);
        void supabase.auth.signOut().finally(() => {
          toast.error("Session expired due to inactivity");
          void navigate({ to: "/auth" });
        });
      } else if (idleFor >= WARN_AFTER_MS) {
        setShowWarning(true);
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, handleActivity);
      }
      window.clearInterval(interval);
    };
  }, [navigate]);

  const stayLoggedIn = useCallback(() => {
    resetActivity();
    setShowWarning(false);
  }, [resetActivity]);

  return (
    <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Session expires in 5 minutes</AlertDialogTitle>
          <AlertDialogDescription>
            You've been inactive for a while. Stay logged in to keep your session active.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={stayLoggedIn}>Stay Logged In</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
