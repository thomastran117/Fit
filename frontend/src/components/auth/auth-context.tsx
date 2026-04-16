"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { AuthResponseBody, StoredAuthSession } from "@/lib/auth/types";
import {
  clearStoredSession,
  getStoredSessionSnapshot,
  subscribeToStoredSession,
  writeStoredSession,
} from "@/lib/auth/storage";

type AuthStatus = "loading" | "anonymous" | "authenticated";

interface AuthContextValue {
  status: AuthStatus;
  session: StoredAuthSession | null;
  setSession: (session: AuthResponseBody) => void;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const session = useSyncExternalStore(
    subscribeToStoredSession,
    getStoredSessionSnapshot,
    () => undefined,
  );

  const status: AuthStatus =
    session === undefined
      ? "loading"
      : session
        ? "authenticated"
        : "anonymous";

  const value: AuthContextValue = {
    status,
    session: session ?? null,
    setSession(nextSession) {
      writeStoredSession(nextSession);
    },
    clearSession() {
      clearStoredSession();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
