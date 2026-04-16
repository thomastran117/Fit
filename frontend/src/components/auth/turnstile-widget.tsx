"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { publicEnv } from "@/lib/env";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: (error?: string | number) => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove?: (widgetId: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  value: string;
  onChange: (value: string) => void;
}

export function TurnstileWidget({ value, onChange }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const renderFailedRef = useRef(false);

  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!publicEnv.turnstileSiteKey) return;
    if (!scriptLoaded) return;
    if (!window.turnstile) return;
    if (!containerRef.current) return;
    if (widgetIdRef.current) return;

    try {
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: publicEnv.turnstileSiteKey,
        theme: "light",
        size: "flexible",
        callback: (token: string) => {
          renderFailedRef.current = false;
          setHasError(false);
          onChange(token);
        },
        "expired-callback": () => {
          onChange("");
        },
        "error-callback": () => {
          setHasError(true);
          onChange("");
        },
      });
    } catch (err) {
      console.error("Turnstile render failed", err);
      renderFailedRef.current = true;
    }

    return () => {
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [scriptLoaded, onChange]);

  useEffect(() => {
    if (!value && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [value]);

  if (!publicEnv.turnstileSiteKey) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Add <code>NEXT_PUBLIC_TURNSTILE_SITE_KEY</code> to load Cloudflare Turnstile.
      </div>
    );
  }

  const showError = hasError || renderFailedRef.current;

  return (
    <div className="space-y-3">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
        onError={() => setHasError(true)}
      />

      <div className="w-full max-w-[420px]">
        <div ref={containerRef} />
      </div>

      {showError && (
        <p className="text-sm text-rose-700">
          Cloudflare Turnstile could not be loaded. Refresh the page and try again.
        </p>
      )}
    </div>
  );
}