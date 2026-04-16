"use client";

import { useState } from "react";
import { publicEnv } from "@/lib/env";
import { authApi } from "@/lib/auth/api";
import type { AuthResponseBody } from "@/lib/auth/types";

type OAuthProvider = "google" | "microsoft";

interface AuthOAuthButtonsProps {
  onSuccess: (session: AuthResponseBody) => void;
  onError: (message: string) => void;
}

interface PopupAuthResult {
  idToken?: string;
  error?: string;
  errorDescription?: string;
  state?: string;
}

const MICROSOFT_SCOPE = "openid email profile";
const GOOGLE_SCOPE = "openid email profile";

function createRandomString(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getPopupFeatures(): string {
  const width = 520;
  const height = 720;
  const left = Math.max(window.screenX + (window.outerWidth - width) / 2, 0);
  const top = Math.max(window.screenY + (window.outerHeight - height) / 2, 0);

  return [
    "popup=yes",
    `width=${width}`,
    `height=${height}`,
    `left=${Math.round(left)}`,
    `top=${Math.round(top)}`,
    "resizable=yes",
    "scrollbars=yes",
  ].join(",");
}

function parsePopupPayload(rawPayload: string): PopupAuthResult {
  const normalized = rawPayload.startsWith("#") || rawPayload.startsWith("?")
    ? rawPayload.slice(1)
    : rawPayload;
  const params = new URLSearchParams(normalized);

  return {
    idToken: params.get("id_token") ?? undefined,
    error: params.get("error") ?? undefined,
    errorDescription: params.get("error_description") ?? undefined,
    state: params.get("state") ?? undefined,
  };
}

function buildOAuthUrl(provider: OAuthProvider, state: string, nonce: string): string {
  const redirectUri = `${window.location.origin}/auth/popup-callback`;

  if (provider === "google") {
    const params = new URLSearchParams({
      client_id: publicEnv.googleOAuthClientId,
      redirect_uri: redirectUri,
      response_type: "id_token",
      scope: GOOGLE_SCOPE,
      prompt: "select_account",
      nonce,
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  const params = new URLSearchParams({
    client_id: publicEnv.microsoftOAuthClientId,
    redirect_uri: redirectUri,
    response_type: "id_token",
    response_mode: "fragment",
    scope: MICROSOFT_SCOPE,
    prompt: "select_account",
    nonce,
    state,
  });

  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

function readProviderError(provider: OAuthProvider, payload: PopupAuthResult): string {
  if (payload.errorDescription) {
    return payload.errorDescription.replace(/\+/g, " ");
  }

  if (payload.error) {
    return `${provider === "google" ? "Google" : "Microsoft"} sign-in failed: ${payload.error}.`;
  }

  return `${provider === "google" ? "Google" : "Microsoft"} sign-in could not be completed.`;
}

function authenticateWithProvider(
  provider: OAuthProvider,
  idToken: string,
): Promise<AuthResponseBody> {
  if (provider === "google") {
    return authApi.authenticateWithGoogle({ idToken });
  }

  return authApi.authenticateWithMicrosoft({ idToken });
}

async function openProviderPopup(provider: OAuthProvider): Promise<string> {
  const state = createRandomString();
  const nonce = createRandomString();
  const popup = window.open(buildOAuthUrl(provider, state, nonce), `${provider}-oauth`, getPopupFeatures());

  if (!popup) {
    throw new Error("Your browser blocked the sign-in popup. Please allow popups and try again.");
  }

  return new Promise<string>((resolve, reject) => {
    let finished = false;

    const cleanup = () => {
      finished = true;
      window.removeEventListener("message", handleMessage);
      clearInterval(closePoll);
    };

    const closePoll = window.setInterval(() => {
      if (popup.closed && !finished) {
        cleanup();
        reject(new Error("The sign-in popup was closed before authentication finished."));
      }
    }, 400);

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      const data = event.data as { source?: string; payload?: string } | undefined;

      if (data?.source !== "rentify-oauth-popup" || typeof data.payload !== "string") {
        return;
      }

      const payload = parsePopupPayload(data.payload);

      if (payload.state !== state) {
        cleanup();
        popup.close();
        reject(new Error("The sign-in response could not be verified. Please try again."));
        return;
      }

      if (payload.error || !payload.idToken) {
        cleanup();
        popup.close();
        reject(new Error(readProviderError(provider, payload)));
        return;
      }

      cleanup();
      popup.close();
      resolve(payload.idToken);
    };

    window.addEventListener("message", handleMessage);
  });
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12.24 10.285v3.955h5.497c-.222 1.273-1.717 3.734-5.497 3.734-3.309 0-6.004-2.739-6.004-6.119s2.695-6.119 6.004-6.119c1.884 0 3.145.803 3.869 1.495l2.64-2.551C17.064 3.107 14.889 2 12.24 2 6.973 2 2.7 6.273 2.7 11.855s4.273 9.855 9.54 9.855c5.507 0 9.16-3.872 9.16-9.326 0-.627-.067-1.107-.151-1.599H12.24Z"
      />
      <path
        fill="#34A853"
        d="M3.802 7.683 7.05 10.06c.879-1.747 2.702-2.956 5.19-2.956 1.884 0 3.145.803 3.869 1.495l2.64-2.551C17.064 3.107 14.889 2 12.24 2c-3.664 0-6.807 2.094-8.438 5.683Z"
      />
      <path
        fill="#FBBC05"
        d="M2.7 11.855c0 1.544.369 2.998 1.024 4.286l3.49-2.69a6.04 6.04 0 0 1-.214-1.596c0-.554.076-1.095.214-1.596l-3.49-2.69A9.795 9.795 0 0 0 2.7 11.855Z"
      />
      <path
        fill="#4285F4"
        d="M12.24 21.71c2.649 0 4.874-.87 6.499-2.366l-3.184-2.612c-.853.599-1.995 1.02-3.315 1.02-2.473 0-4.285-1.671-5.185-3.918l-3.463 2.671C5.212 19.643 8.454 21.71 12.24 21.71Z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#F25022" d="M3 3h8.5v8.5H3z" />
      <path fill="#7FBA00" d="M12.5 3H21v8.5h-8.5z" />
      <path fill="#00A4EF" d="M3 12.5h8.5V21H3z" />
      <path fill="#FFB900" d="M12.5 12.5H21V21h-8.5z" />
    </svg>
  );
}

export function AuthOAuthButtons({ onSuccess, onError }: AuthOAuthButtonsProps) {
  const [pendingProvider, setPendingProvider] = useState<OAuthProvider | null>(null);

  const googleEnabled = Boolean(publicEnv.googleOAuthClientId);
  const microsoftEnabled = Boolean(publicEnv.microsoftOAuthClientId);

  async function handleProviderClick(provider: OAuthProvider) {
    setPendingProvider(provider);
    onError("");

    try {
      const idToken = await openProviderPopup(provider);
      const session = await authenticateWithProvider(provider, idToken);
      onSuccess(session);
    } catch (error) {
      onError(error instanceof Error ? error.message : "OAuth sign-in could not be completed.");
    } finally {
      setPendingProvider(null);
    }
  }

  if (!googleEnabled && !microsoftEnabled) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {googleEnabled ? (
          <button
            type="button"
            onClick={() => handleProviderClick("google")}
            disabled={pendingProvider !== null}
            className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm font-semibold text-slate-900 transition hover:border-indigo-200 hover:bg-indigo-50/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleIcon />
            {pendingProvider === "google" ? "Connecting..." : "Continue with Google"}
          </button>
        ) : null}

        {microsoftEnabled ? (
          <button
            type="button"
            onClick={() => handleProviderClick("microsoft")}
            disabled={pendingProvider !== null}
            className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm font-semibold text-slate-900 transition hover:border-sky-200 hover:bg-sky-50/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <MicrosoftIcon />
            {pendingProvider === "microsoft" ? "Connecting..." : "Continue with Microsoft"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
