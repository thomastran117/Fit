"use client";

import type { StoredAuthSession } from "@/lib/auth/types";

const SESSION_STORAGE_KEY = "rentify.auth.session";
const AUTH_STORAGE_EVENT = "rentify-auth-storage";

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function readStoredSession(): StoredAuthSession | null {
  if (!canUseStorage()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as StoredAuthSession;
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

function emitStorageChange(): void {
  if (!canUseStorage()) {
    return;
  }

  window.dispatchEvent(new Event(AUTH_STORAGE_EVENT));
}

export function getStoredSessionSnapshot(): StoredAuthSession | null | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return readStoredSession();
}

export function subscribeToStoredSession(onStoreChange: () => void): () => void {
  if (!canUseStorage()) {
    return () => undefined;
  }

  const handleChange = () => {
    onStoreChange();
  };

  window.addEventListener("storage", handleChange);
  window.addEventListener(AUTH_STORAGE_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(AUTH_STORAGE_EVENT, handleChange);
  };
}

export function writeStoredSession(session: StoredAuthSession): void {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  emitStorageChange();
}

export function clearStoredSession(): void {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  emitStorageChange();
}
