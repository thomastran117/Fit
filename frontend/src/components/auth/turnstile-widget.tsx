"use client";

import { useEffect, useId, useRef, useState } from "react";
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
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  value: string;
  onChange: (value: string) => void;
}

export function TurnstileWidget({ value, onChange }: TurnstileWidgetProps) {
  const containerId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (
      !publicEnv.turnstileSiteKey ||
      !scriptReady ||
      !containerRef.current ||
      widgetIdRef.current ||
      !window.turnstile
    ) {
      return;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: publicEnv.turnstileSiteKey,
      theme: "light",
      callback(token) {
        setHasError(false);
        onChange(token);
      },
      "expired-callback"() {
        onChange("");
      },
      "error-callback"() {
        setHasError(true);
        onChange("");
      },
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [onChange, scriptReady]);

  if (!publicEnv.turnstileSiteKey) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/80 p-4 text-sm text-amber-900">
        <p className="font-semibold">Turnstile site key missing</p>
        <p className="mt-1 leading-6 text-amber-800">
          Add <code>NEXT_PUBLIC_TURNSTILE_SITE_KEY</code> to render the captcha widget.
        </p>
        <button
          type="button"
          onClick={() => onChange("development-placeholder-token")}
          className="mt-3 inline-flex rounded-full border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
        >
          Use local development token
        </button>
        {value ? (
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-emerald-700">
            Captcha token ready
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => {
          setScriptReady(true);
          if (!window.turnstile) {
            setHasError(true);
          }
        }}
        onError={() => setHasError(true)}
      />
      <div
        id={containerId}
        ref={containerRef}
        className="min-h-[72px] rounded-2xl border border-slate-200 bg-white/80 p-3"
      />
      {hasError ? (
        <p className="text-sm text-rose-700">
          Captcha could not be loaded. Refresh the page and try again.
        </p>
      ) : null}
      {value ? (
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
          Captcha verified
        </p>
      ) : null}
    </div>
  );
}
