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

    async function restoreSession() {
      try {
        if (!session && authApi.hasRefreshCookieHint()) {
          await authApi.refresh();
        }
      } finally {
        onComplete();
      }
    }

    void restoreSession();
  }, [onComplete, session]);

  return null;
}
