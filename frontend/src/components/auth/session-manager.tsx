"use client";

import { useEffect, useRef } from "react";
import type { StoredAuthSession } from "@/lib/auth/types";
import { authApi } from "@/lib/auth/api";

interface SessionManagerProps {
  session: StoredAuthSession | null | undefined;
  onComplete: () => void;
}

export function SessionManager({ session, onComplete }: SessionManagerProps) {
  const hasAttemptedInitialRestore = useRef(false);

  useEffect(() => {
    if (session === undefined || hasAttemptedInitialRestore.current) {
      return;
    }

    hasAttemptedInitialRestore.current = true;
    let cancelled = false;

    async function restoreSession() {
      try {
        if (!session) {
          await authApi.refresh();
        }
      } finally {
        if (!cancelled) {
          onComplete();
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [onComplete, session]);

  return null;
}
